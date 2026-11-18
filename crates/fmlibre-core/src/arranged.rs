//! Arranging a transfer for the next day, which the game then makes itself.
//!
//! A move the editor makes at once leaves the game's history as it was: the season under way shows one row, for the new
//! club, with what the player did at the old one, and no fee. When the game makes a transfer, it closes the old club's
//! row, opens one for the new club with the fee, writes its own records of the move and pays the fee. The editor gets
//! all of that by agreeing a transfer for the next day as the game keeps one: on that day the game makes it as it makes
//! its own.
//!
//! A move agreed for a later day, as the game keeps one ([`TransfersLayout`], read on Game Pass 0.9.2524.0):
//! - an offer of the transfer manager's list of offers, agreed (state 19): the player, the buying team twice, the
//!   selling team, the fee in pounds, the offer's number, the day it was made, the day it lapses and the day of the
//!   move. It is laid out as one of the game's own agreed transfers, whose bytes it starts from, in a slot of the game's
//!   pool of offers;
//! - the contract he is to have: his own, copied, with the buying club's senior team, from the day of the move (see
//!   `signing.rs`), in a slot of the game's pool of contracts;
//! - an entry naming that contract and the offer's number, agreed and waiting (state 2), in the player's record of
//!   entries, and the offer's number in his record of offers' numbers;
//! - the move due on that day, in the manager's list of them (the player, the day, the offer's number), and the flag the
//!   manager raises while one is due. Without it the game shows the transfer as arranged for 1 January 1900 and never
//!   makes it.
//!
//! The entry, the move due and any record or list the editor makes or grows are blocks of the game's heap, taken by the
//! game's C runtime (see `heap.rs`): the game gives some of them back to the runtime's `free()`. Until the day, an undo
//! takes it all back and gives those blocks back; once the game has made the move, nothing is left to undo.

use fmlibre_mem::is_user_pointer;

use crate::clubs::ClubSummary;
use crate::date::FmDate;
use crate::edit::Kind;
use crate::players::PlayerSummary;
use crate::profile::TransfersLayout;
use crate::rtti;
use crate::session::Session;
use crate::transfer::{MAX_FEE, MoveError, MoveTerms, Patch, Patches, PointerList};

/// The most offers the editor takes the manager's list to hold.
const MOST_OFFERS: u64 = 200_000;

/// The flags of the agreed transfers the game makes most, and the states of an offer: still to be answered by the club
/// (0) or by the player (8), agreed (19).
const TRANSFER_FLAGS: u32 = 0x40;
const AGREED: u8 = 19;
const UNDER_WAY: [u8; 3] = [0, 8, 19];

/// How long an offer stands, in days, as the game's do.
const OFFER_STANDS: i64 = 30;

/// What the game keeps in an entry where it has no amount, the entry's state while agreed and waiting, and its kind for
/// a transfer with a fee.
const NO_AMOUNT: i32 = -9_999_999;
const WAITING: u8 = 2;
const TRANSFER_KIND: u8 = 2;

/// A date the game has not set: day 1 of 1900.
const UNSET_DATE: [u8; 4] = [0x01, 0x00, 0x6C, 0x07];

/// The room a list the editor makes has, in elements, and how a full one grows: by half again, as the game's do.
const NEW_LIST_ROOM: u64 = 4;

/// What arranging a transfer does, worked out from the game as it is now. The entry, the move due and the lists they
/// join are made as it is written.
#[derive(Debug, Clone)]
pub struct ArrangedPlan {
    pub player: u32,
    pub from_club: u32,
    pub to_club: u32,
    /// Pounds.
    pub fee: i64,
    /// The day the game makes the move.
    pub move_day: FmDate,
    pub offer_number: u32,
    /// Where the offer and the contract go.
    pub offer: u64,
    pub contract: u64,
    /// Taking the two slots and filling them.
    patches: Vec<Patch>,
    /// Blocks of the game's heap already taken for the plan: a slot of a pool that had none free.
    blocks: Vec<u64>,
    /// The player's object and person block, and the transfer manager.
    object: u64,
    person: u64,
    manager: u64,
}

/// A transfer arranged: what undoing it takes, until the game makes it.
#[derive(Debug, Clone)]
pub struct Arranged {
    pub player: u32,
    pub move_day: FmDate,
    patches: Vec<Patch>,
    /// The blocks of the game's heap the editor took, given back by an undo.
    blocks: Vec<u64>,
}

/// An agreed offer's bytes, made from `template`, one of the game's own.
#[allow(clippy::too_many_arguments)]
fn offer_bytes(
    t: &TransfersLayout,
    template: &[u8],
    person: u64,
    buyer: u64,
    seller: u64,
    fee: u32,
    number: u32,
    count: u32,
    today: FmDate,
    move_day: FmDate,
) -> Vec<u8> {
    let date = |day: FmDate| Kind::Date.encode(day.to_number(), &[0; 4]);
    let mut offer = template.to_vec();
    let mut put = |at: u64, value: &[u8]| offer[at as usize..at as usize + value.len()].copy_from_slice(value);
    put(t.offer_one, &1u64.to_le_bytes());
    put(t.offer_flags, &u64::from(TRANSFER_FLAGS).to_le_bytes());
    put(t.offer_person, &person.to_le_bytes());
    put(t.offer_buyer, &buyer.to_le_bytes());
    put(t.offer_buyer_again, &buyer.to_le_bytes());
    put(t.offer_seller, &seller.to_le_bytes());
    put(t.offer_fee, &fee.to_le_bytes());
    put(t.offer_number, &number.to_le_bytes());
    put(t.offer_count, &count.to_le_bytes());
    for &at in &t.offer_unset {
        put(at, &(-1i32).to_le_bytes());
    }
    for at in [t.offer_accepted, t.offer_moved, t.offer_later] {
        put(at, &UNSET_DATE);
    }
    put(t.offer_made, &date(today));
    put(t.offer_lapses, &date(today.plus_days(OFFER_STANDS)));
    put(t.offer_move_day, &date(move_day));
    put(t.offer_state, &[AGREED]);
    put(t.offer_payment, &0u64.to_le_bytes());
    offer
}

/// An entry's bytes: the contract, the offer's number, agreed and waiting.
fn entry_bytes(t: &TransfersLayout, contract: u64, number: u32) -> Vec<u8> {
    let mut entry = vec![0u8; t.entry_size as usize];
    let mut put = |at: u64, value: &[u8]| entry[at as usize..at as usize + value.len()].copy_from_slice(value);
    put(t.entry_one, &1u32.to_le_bytes());
    put(t.entry_contract, &contract.to_le_bytes());
    put(t.entry_number, &number.to_le_bytes());
    put(t.entry_no_amount, &NO_AMOUNT.to_le_bytes());
    put(t.entry_date, &UNSET_DATE);
    put(t.entry_state, &[WAITING]);
    put(t.entry_one_again, &[1]);
    put(t.entry_agreed, &[1]);
    put(t.entry_kind, &[TRANSFER_KIND]);
    entry
}

/// A move due's bytes: the player's person block, the day (without the flags other dates carry) and the offer's number.
fn due_bytes(t: &TransfersLayout, person: u64, day: FmDate, number: u32) -> Vec<u8> {
    let mut due = vec![0u8; t.due_size as usize];
    let mut put = |at: u64, value: &[u8]| due[at as usize..at as usize + value.len()].copy_from_slice(value);
    put(t.due_person, &person.to_le_bytes());
    put(t.due_day, &Kind::Date.encode(day.to_number(), &[0; 4]));
    put(t.due_number, &number.to_le_bytes());
    due
}

/// How many elements a full list of `len` grows to: half as many again, as the game's lists grow, and some room at the
/// least.
fn grown_capacity(len: u64) -> u64 {
    (len + len / 2).max(len + 1).max(NEW_LIST_ROOM)
}

impl Session {
    /// The layout of the game's transfers, when this version of the game has one and the editor can take blocks of the
    /// game's heap, which an arranged transfer needs.
    fn transfers_layout(&self) -> Result<&TransfersLayout, MoveError> {
        let layout = self.layout.transfers.as_ref().ok_or(MoveError::NoTransfers)?;
        if !self.takes_heap_blocks() {
            return Err(MoveError::NoGameMemory);
        }
        Ok(layout)
    }

    /// Whether this version of the game, on this system, lets the editor arrange a transfer for the next day.
    pub fn arranges_transfers(&self) -> bool {
        self.transfers_layout().is_ok()
    }

    /// Works out arranging the move of `player` to the senior team of `club` for the next day, for `fee` pounds, on the
    /// contract `terms` (see the module's notes). `human_clubs` are the UIDs of the clubs human managers run. Nothing
    /// is written, but a pool with no slot free has one taken of the game's heap for it.
    pub fn plan_arranged_transfer(
        &self,
        player: &PlayerSummary,
        club: &ClubSummary,
        terms: MoveTerms,
        fee: i64,
        human_clubs: &[u32],
    ) -> Result<ArrangedPlan, MoveError> {
        let t = self.transfers_layout()?;
        let (process, layout) = (&self.process, &self.layout);
        let (Some(contract_size), Some(pools)) = (layout.contract.size, layout.pool.as_ref()) else {
            return Err(MoveError::NoPool);
        };
        if !(0..=MAX_FEE).contains(&fee) {
            return Err(MoveError::OutOfRange { field: "fee", value: fee, min: 0, max: MAX_FEE });
        }
        let today = self.game_date().ok_or(MoveError::NoDate)?;
        self.check_terms(terms, Some(today))?;
        let leaving = self.departure(player, human_clubs)?;
        if process.read_u32(club.address + layout.club.uid)? != club.uid {
            return Err(MoveError::NotAClub { uid: club.uid });
        }
        if leaving.club == club.address {
            return Err(MoveError::SameClub);
        }
        let women = process.read_bytes(club.address + layout.club.women, 1)?[0] != 0;
        if player.woman.is_some_and(|woman| woman != women) {
            return Err(MoveError::MenAndWomen);
        }
        let joining = self.arrival(club.address, &leaving)?;
        let person = leaving.object + layout.player.identity();

        // The game's offers: none may be under way for him, and the new one takes the next number and count.
        let manager = self.transfer_manager(t)?;
        let offers = self.manager_list(manager + t.offers)?;
        let (mut number, mut count, mut template) = (0u32, 0u32, None);
        for offer in offers.elements(process)? {
            let Ok(bytes) = process.read_bytes(offer, t.offer_size as usize) else {
                continue;
            };
            let word = |at: u64| u64::from_le_bytes(bytes[at as usize..at as usize + 8].try_into().expect("8 bytes"));
            let half = |at: u64| u32::from_le_bytes(bytes[at as usize..at as usize + 4].try_into().expect("4 bytes"));
            let state = bytes[t.offer_state as usize];
            if word(t.offer_person) == person && UNDER_WAY.contains(&state) {
                return Err(MoveError::DealUnderWay);
            }
            number = number.max(half(t.offer_number));
            count = count.max(half(t.offer_count));
            // One of the game's own agreed transfers, the kind it makes most, is the model.
            if state == AGREED && (template.is_none() || half(t.offer_flags) == TRANSFER_FLAGS) {
                let better =
                    template.as_ref().is_none_or(|(_, flags, _): &(u64, u32, Vec<u8>)| *flags != TRANSFER_FLAGS);
                if better {
                    template = Some((offer, half(t.offer_flags), bytes.clone()));
                }
            }
        }
        let (model_offer, _, template) = template.ok_or(MoveError::NoTransfers)?;
        let (number, count) = (number + 1, count + 1);

        let move_day = today.plus_days(1);
        let fee =
            u32::try_from(fee).map_err(|_| MoveError::OutOfRange { field: "fee", value: fee, min: 0, max: MAX_FEE })?;
        let offer =
            offer_bytes(t, &template, person, joining.senior, leaving.employer, fee, number, count, today, move_day);
        let model = process.read_bytes(leaving.contract, contract_size as usize)?;
        let contract = self.new_contract(model, leaving.object, joining.senior, terms, today, move_day, None);

        let mut patches = Patches::default();
        let mut blocks = Vec::new();
        let offer_at = self.slot_for(model_offer, t.offer_size, pools, offer, &mut patches, &mut blocks)?;
        let contract_at = self.slot_for(leaving.contract, contract_size, pools, contract, &mut patches, &mut blocks);
        let contract_at = match contract_at {
            Ok(at) => at,
            Err(err) => {
                self.give_back(&blocks);
                return Err(err);
            }
        };
        Ok(ArrangedPlan {
            player: player.uid,
            from_club: leaving.club_uid,
            to_club: joining.club_uid,
            fee: i64::from(fee),
            move_day,
            offer_number: number,
            offer: offer_at,
            contract: contract_at,
            patches: patches.0,
            blocks,
            object: leaving.object,
            person,
            manager,
        })
    }

    /// Gives back the blocks of the game's heap an arranged transfer took, when it is not written after all.
    pub fn drop_arranged_plan(&self, plan: ArrangedPlan) {
        self.give_back(&plan.blocks);
    }

    /// Writes an arranged transfer: the offer and the contract into their slots, the entry and the move due into blocks
    /// of the game's heap, then the links to them, the offer and the move due last. When a write fails, the ones before
    /// it are put back and the blocks given back.
    pub fn apply_arranged_transfer(&self, plan: ArrangedPlan) -> Result<Arranged, MoveError> {
        let t = self.transfers_layout()?;
        let mut blocks = plan.blocks.clone();
        let result = self.arranged_links(t, &plan, &mut blocks).and_then(|links| {
            let all: Vec<Patch> = plan.patches.iter().cloned().chain(links).collect();
            self.apply_patches(&all).map(|()| all)
        });
        match result {
            Ok(patches) => Ok(Arranged { player: plan.player, move_day: plan.move_day, patches, blocks }),
            Err(err) => {
                self.give_back(&blocks);
                Err(err)
            }
        }
    }

    /// Takes an arranged transfer back, provided the game still holds everything it wrote: until the day of the move.
    /// The blocks of the game's heap it took are given back.
    pub fn undo_arranged_transfer(&self, done: &Arranged) -> Result<(), MoveError> {
        self.undo_patches(&done.patches)?;
        self.give_back(&done.blocks);
        Ok(())
    }

    /// The entry and the move due, made in blocks of the game's heap, and the writes that link them and the offer in.
    fn arranged_links(
        &self,
        t: &TransfersLayout,
        plan: &ArrangedPlan,
        blocks: &mut Vec<u64>,
    ) -> Result<Vec<Patch>, MoveError> {
        let p = &self.layout.player;
        let entry = self.heap_block(t.entry_size as usize)?;
        blocks.push(entry);
        self.process.write_bytes(entry, &entry_bytes(t, plan.contract, plan.offer_number))?;
        let due = self.heap_block(t.due_size as usize)?;
        blocks.push(due);
        self.process.write_bytes(due, &due_bytes(t, plan.person, plan.move_day, plan.offer_number))?;

        let mut links = Patches::default();
        let entries_at = plan.object + p.at(t.player_entries, 0);
        self.add_to_record(t, entries_at, &entry.to_le_bytes(), &mut links, blocks)?;
        let numbers_at = plan.object + p.at(t.player_offer_numbers, 0);
        self.add_to_record(t, numbers_at, &plan.offer_number.to_le_bytes(), &mut links, blocks)?;
        // The offer, then the move due, once all they lead to is in place; then the flag that a move is due.
        self.add_to_list(plan.manager + t.offers, &plan.offer.to_le_bytes(), &mut links, blocks)?;
        self.add_to_list(plan.manager + t.due, &due.to_le_bytes(), &mut links, blocks)?;
        let flag = self.process.read_bytes(plan.manager + t.due_flag, 1)?;
        links.push(plan.manager + t.due_flag, flag, [1]);
        Ok(links.0)
    }

    /// The transfer manager: the one object of its class.
    fn transfer_manager(&self, t: &TransfersLayout) -> Result<u64, MoveError> {
        let vtables = rtti::vtables(&self.process, &self.plugin, &t.manager_class);
        let objects = rtti::objects(&self.process, &self.plugin, &vtables)?;
        let managers: Vec<u64> = objects.into_values().flatten().collect();
        match managers[..] {
            [manager] => Ok(manager),
            _ => Err(MoveError::NoTransfers),
        }
    }

    /// One of the manager's lists of pointers, when it checks out.
    fn manager_list(&self, header: u64) -> Result<PointerList, MoveError> {
        PointerList::read_up_to(&self.process, header, MOST_OFFERS)?.ok_or(MoveError::NoTransfers)
    }

    /// Where an object of `size` bytes goes: the first free slot of the pool that holds `model`, taken as the game takes
    /// one, or, when the pool has none free, a block of the game's heap, which the pool takes as its own once the game
    /// lets go of it. Its bytes become `bytes`.
    fn slot_for(
        &self,
        model: u64,
        size: u64,
        pools: &crate::profile::PoolLayout,
        bytes: Vec<u8>,
        patches: &mut Patches,
        blocks: &mut Vec<u64>,
    ) -> Result<u64, MoveError> {
        let pool = self.pool_holding(model, size)?;
        match pool.take(&self.process, pools) {
            Ok(taken) => {
                patches.push(taken.pool.address, taken.pool.before, taken.pool.after);
                patches.push(taken.slot, taken.was, bytes);
                Ok(taken.slot)
            }
            Err(MoveError::PoolFull) => {
                let block = self.heap_block(size as usize)?;
                blocks.push(block);
                patches.push(block, vec![0; size as usize], bytes);
                Ok(block)
            }
            Err(err) => Err(err),
        }
    }

    /// Adds `element` (4 or 8 bytes) to the list of the record the pointer at `at` leads to; a record of its own when
    /// the pointer is null, in a block of the game's heap.
    fn add_to_record(
        &self,
        t: &TransfersLayout,
        at: u64,
        element: &[u8],
        patches: &mut Patches,
        blocks: &mut Vec<u64>,
    ) -> Result<(), MoveError> {
        let record = self.process.read_u64(at)?;
        if record != 0 {
            if !is_user_pointer(record) {
                return Err(MoveError::UnusualContract);
            }
            return self.add_to_list(record, element, patches, blocks);
        }
        let size = element.len() as u64;
        let buffer = self.heap_block((NEW_LIST_ROOM * size) as usize)?;
        blocks.push(buffer);
        self.process.write_bytes(buffer, element)?;
        let made = self.heap_block(t.record_size as usize)?;
        blocks.push(made);
        let words: Vec<u8> =
            [buffer, buffer + size, buffer + NEW_LIST_ROOM * size].iter().flat_map(|w| w.to_le_bytes()).collect();
        self.process.write_bytes(made, &words)?;
        patches.push(at, 0u64.to_le_bytes(), made.to_le_bytes());
        Ok(())
    }

    /// Adds `element` (4 or 8 bytes) at the end of the list `(begin, end, capacity)` at `header`: in the room it has, or
    /// in a block of the game's heap half as large again, which the list then points at. The old block stays as it was,
    /// for the undo.
    fn add_to_list(
        &self,
        header: u64,
        element: &[u8],
        patches: &mut Patches,
        blocks: &mut Vec<u64>,
    ) -> Result<(), MoveError> {
        let size = element.len() as u64;
        let words = self.process.read_bytes(header, 24)?;
        let word = |i: usize| u64::from_le_bytes(words[i * 8..i * 8 + 8].try_into().expect("8 bytes"));
        let (begin, end, capacity) = (word(0), word(1), word(2));
        let empty = begin == 0 && end == 0 && capacity == 0;
        let sound = empty
            || (is_user_pointer(begin)
                && begin <= end
                && end <= capacity
                && (end - begin).is_multiple_of(size)
                && (capacity - begin).is_multiple_of(size)
                && (capacity - begin) / size <= MOST_OFFERS);
        if !sound {
            return Err(MoveError::NoTransfers);
        }
        if !empty && end < capacity {
            patches.push(end, self.process.read_bytes(end, element.len())?, element.to_vec());
            patches.push(header + 8, end.to_le_bytes(), (end + size).to_le_bytes());
            return Ok(());
        }
        let len = if empty { 0 } else { (end - begin) / size };
        let room = grown_capacity(len);
        let buffer = self.heap_block((room * size) as usize)?;
        blocks.push(buffer);
        let mut bytes = if empty { Vec::new() } else { self.process.read_bytes(begin, (end - begin) as usize)? };
        bytes.extend_from_slice(element);
        self.process.write_bytes(buffer, &bytes)?;
        let after: Vec<u8> =
            [buffer, buffer + (len + 1) * size, buffer + room * size].iter().flat_map(|w| w.to_le_bytes()).collect();
        patches.push(header, words, after);
        Ok(())
    }

    /// Gives back blocks of the game's heap, as far as it can.
    fn give_back(&self, blocks: &[u64]) {
        for &block in blocks.iter().rev() {
            let _ = self.heap_free(block);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn layout() -> TransfersLayout {
        crate::profile::windows_layout().transfers.expect("the Windows layout places the transfers")
    }

    #[test]
    fn an_offer_is_agreed_for_the_day_of_the_move() {
        let t = layout();
        let template = vec![0xAA; t.offer_size as usize];
        let today = FmDate::from_number(20261016).expect("a date");
        let offer = offer_bytes(
            &t,
            &template,
            0x1_0000_0010,
            0x2_0000_0020,
            0x3_0000_0030,
            7_777_777,
            5181,
            6403,
            today,
            today.plus_days(1),
        );
        let half = |at: u64| u32::from_le_bytes(offer[at as usize..at as usize + 4].try_into().expect("4 bytes"));
        let word = |at: u64| u64::from_le_bytes(offer[at as usize..at as usize + 8].try_into().expect("8 bytes"));
        assert_eq!(word(t.offer_person), 0x1_0000_0010);
        assert_eq!((word(t.offer_buyer), word(t.offer_buyer_again)), (0x2_0000_0020, 0x2_0000_0020));
        assert_eq!(word(t.offer_seller), 0x3_0000_0030);
        assert_eq!((half(t.offer_fee), half(t.offer_number), half(t.offer_count)), (7_777_777, 5181, 6403));
        assert_eq!(offer[t.offer_state as usize], AGREED);
        assert_eq!(word(t.offer_payment), 0);
        let day =
            |at: u64| FmDate::from_raw((half(at) & 0xFFFF) as u16, (half(at) >> 16) as u16).map(FmDate::to_number);
        assert_eq!(day(t.offer_made), Some(20261016));
        assert_eq!(day(t.offer_move_day), Some(20261017));
        assert_eq!(day(t.offer_lapses), Some(20261115));
        // What the layout does not name is the model's.
        assert_eq!(offer[t.offer_size as usize - 1], 0xAA);
    }

    #[test]
    fn a_move_due_names_the_player_the_day_and_the_offer() {
        let t = layout();
        let day = FmDate::from_number(20261018).expect("a date");
        let due = due_bytes(&t, 0x1a1_da30_7ea0, day, 5181);
        assert_eq!(due, [0xa0, 0x7e, 0x30, 0xda, 0xa1, 0x01, 0, 0, 0x23, 0x01, 0xea, 0x07, 0x3d, 0x14, 0, 0]);
    }

    #[test]
    fn an_entry_waits_for_its_day() {
        let t = layout();
        let entry = entry_bytes(&t, 0x1a1_e5c8_43d8, 5181);
        assert_eq!(entry.len(), 0x48);
        assert_eq!(&entry[0x10..0x18], &0x1a1_e5c8_43d8u64.to_le_bytes());
        assert_eq!(&entry[0x28..0x30], &[0x3d, 0x14, 0, 0, 0x81, 0x69, 0x67, 0xff]);
        assert_eq!(&entry[0x3E..0x42], &[2, 1, 1, 2]);
    }

    #[test]
    fn a_full_list_grows_by_half_again() {
        assert_eq!(grown_capacity(103), 154);
        assert_eq!(grown_capacity(5178), 7767);
        assert_eq!(grown_capacity(0), NEW_LIST_ROOM);
        assert_eq!(grown_capacity(1), NEW_LIST_ROOM);
    }
}
