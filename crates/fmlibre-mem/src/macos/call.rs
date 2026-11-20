//! Running one of the process's functions on a thread of its own, as `CreateRemoteThread` does on Windows.
//!
//! macOS has no such call. A bare Mach thread made in another process (`thread_create`) lacks what the process's own
//! threads have, which the C library's functions rely on, but macOS gives it one function it may call,
//! `pthread_create_from_mach_thread`, to start a thread like the process's own. So the editor makes a bare thread in
//! the process, suspended, sets its registers to call `pthread_create_from_mach_thread` with the function and its
//! argument, and its return address to 0, and lets it run. Once it has started the new thread, the bare thread returns
//! to 0 and faults. The fault goes to the editor alone, through the bare thread's exception port, which the editor set
//! to a port of its own; the editor answers it, with the bare thread suspended, and ends the bare thread. The new
//! thread runs the function and ends. The system keeps what it returned until the thread is joined; the editor reads
//! it there, and then has `pthread_detach` let the thread go, run the same way on a thread that lets itself go when it
//! ends.
//!
//! No code is written into the process: only the bare thread's registers, and in memory the editor takes in the
//! process, its stack, the slot the new thread's handle goes into and the attributes of a thread that lets itself go.
//!
//! Only on Apple silicon. Rosetta does not let a translated process's thread be given registers ("rosetta error:
//! unable to set gpr state", and the process stops), and the editor has not run it on an Intel Mac.

use std::ffi::CStr;

use super::macho::MachImage;
use super::module::list_modules;
use super::process::Process;
use crate::error::{Error, Result};

/// What a call needs in the process: found and taken the first time.
#[derive(Debug, Clone, Copy)]
#[cfg_attr(not(target_arch = "aarch64"), allow(dead_code))]
pub(crate) struct Calls {
    /// The memory a call uses in the process (see `running::AREA`).
    area: u64,
    /// `pthread_create_from_mach_thread` and `pthread_detach`, where the process has them.
    start: u64,
    detach: u64,
}

impl Process {
    /// Where the process has `symbol`, a function of the system's library `library` (its file name, e.g.
    /// `libsystem_c.dylib`): where this process has it, moved by as much as the library lies elsewhere in the
    /// process. None where this process does not find it in that library, or where the process has another build of
    /// the library (another UUID), such as a game run as Intel code under Rosetta.
    pub fn system_function(&self, library: &str, symbol: &CStr) -> Result<Option<u64>> {
        let ours = unsafe { libc::dlsym(libc::RTLD_DEFAULT, symbol.as_ptr()) };
        if ours.is_null() {
            return Ok(None);
        }
        let mut info: libc::Dl_info = unsafe { std::mem::zeroed() };
        if unsafe { libc::dladdr(ours, &mut info) } == 0 || info.dli_fbase.is_null() || info.dli_fname.is_null() {
            return Ok(None);
        }
        let path = unsafe { CStr::from_ptr(info.dli_fname) }.to_string_lossy().into_owned();
        if path.rsplit('/').next() != Some(library) {
            return Ok(None);
        }
        let Some(module) = list_modules(self)?.into_iter().find(|module| module.name == library) else {
            return Ok(None);
        };
        let our_base = info.dli_fbase as u64;
        let own = MachImage::read(&Process::open_read(std::process::id())?, our_base)?;
        let theirs = MachImage::read(self, module.base)?;
        if own.uuid.is_none() || own.uuid != theirs.uuid {
            return Ok(None);
        }
        Ok(Some(module.base + (ours as u64 - our_base)))
    }

    /// Whether [`Process::call`] can run the process's functions: it is open for writing, the editor runs on Apple
    /// silicon, and the process has the system's thread library the editor has.
    pub fn can_call(&self) -> bool {
        cfg!(target_arch = "aarch64")
            && self.can_write()
            && ["pthread_create_from_mach_thread", "pthread_detach"].iter().all(|name| {
                let symbol = std::ffi::CString::new(*name).expect("no NUL");
                self.system_function("libsystem_pthread.dylib", &symbol).is_ok_and(|found| found.is_some())
            })
    }

    /// Runs `function`, a function the process has loaded that takes one argument, on a new thread of the process
    /// with `argument`, waits for it to return, and gives back what it returned (see the module's notes). No code is
    /// written into the process. Gives up after ten seconds for each step. Only on Apple silicon.
    pub fn call(&self, function: u64, argument: u64) -> Result<u64> {
        if !self.can_write() {
            return Err(Error::ReadOnly);
        }
        #[cfg(target_arch = "aarch64")]
        return running::call(self, function, argument);
        #[cfg(not(target_arch = "aarch64"))]
        {
            let _ = (function, argument);
            Err(Error::Call { reason: "the editor runs the game's functions on Apple silicon only" })
        }
    }
}

#[cfg(target_arch = "aarch64")]
mod running {
    use std::ffi::CStr;
    use std::sync::PoisonError;
    use std::time::{Duration, Instant};

    use mach2::exc::{__Reply__exception_raise_t, __Request__exception_raise_t};
    use mach2::exception_types::{
        EXC_BAD_ACCESS, EXC_MASK_ARITHMETIC, EXC_MASK_BAD_ACCESS, EXC_MASK_BAD_INSTRUCTION, EXC_MASK_BREAKPOINT,
        EXC_MASK_SOFTWARE, EXCEPTION_DEFAULT,
    };
    use mach2::kern_return::{KERN_SUCCESS, kern_return_t};
    use mach2::mach_port::{mach_port_allocate, mach_port_deallocate, mach_port_insert_right, mach_port_mod_refs};
    use mach2::message::{
        MACH_MSG_TYPE_MAKE_SEND, MACH_MSGH_BITS, MACH_MSGH_BITS_COMPLEX, MACH_RCV_MSG, MACH_RCV_TIMED_OUT,
        MACH_RCV_TIMEOUT, MACH_SEND_MSG, MACH_SEND_TIMEOUT, mach_msg, mach_msg_destroy, mach_msg_header_t,
        mach_msg_size_t,
    };
    use mach2::ndr::NDR_record;
    use mach2::port::{MACH_PORT_NULL, MACH_PORT_RIGHT_RECEIVE, mach_port_t};
    use mach2::structs::arm_thread_state64_t as Registers;
    use mach2::task::thread_create;
    use mach2::thread_act::{
        thread_get_state, thread_resume, thread_set_exception_ports, thread_set_state, thread_suspend,
    };
    use mach2::thread_status::{ARM_THREAD_STATE64, THREAD_STATE_NONE};
    use mach2::traps::mach_task_self;

    use super::{Calls, Process};
    use crate::error::{Error, Result};

    /// How long a call waits for each of its steps: the bare thread starting the new one, and the new one running the
    /// function.
    const CALL_WAIT: Duration = Duration::from_secs(10);

    /// The memory a call uses in the process, taken the first time: the attributes of a thread that lets itself go (a
    /// `pthread_attr_t`), the slot `pthread_create_from_mach_thread` puts the new thread's handle in, and the bare
    /// thread's stack, whose top it starts from.
    const AREA: usize = 0x1_0000;
    const DETACHED: u64 = 0x00;
    const HANDLE: u64 = 0x40;
    const STACK_TOP: u64 = AREA as u64 - 0x100;

    /// Where the system keeps, in a thread that has ended and is not joined yet (libpthread's `struct _pthread`, which
    /// the handle points at), what its function returned, and the gate it sets to `MACH_PORT_DEAD` as the thread
    /// ends. The tests below check both on the system they run on.
    const EXIT_VALUE: u64 = 0x28;
    const EXIT_GATE: u64 = 0x34;
    const ENDED: u32 = u32::MAX;

    /// The faults of a bare thread that its exception port gets: all a thread that runs one function can have.
    const FAULTS: u32 =
        EXC_MASK_BAD_ACCESS | EXC_MASK_BAD_INSTRUCTION | EXC_MASK_ARITHMETIC | EXC_MASK_SOFTWARE | EXC_MASK_BREAKPOINT;

    /// The `msgh_id` of the kernel's `exception_raise`, as `EXCEPTION_DEFAULT` sends it.
    const EXCEPTION_RAISE: i32 = 2401;

    pub(super) fn call(process: &Process, function: u64, argument: u64) -> Result<u64> {
        // One call at a time: they share the memory they use.
        let mut kept = process.calls.lock().unwrap_or_else(PoisonError::into_inner);
        let calls = match *kept {
            Some(calls) => calls,
            None => *kept.insert(prepare(process)?),
        };
        let thread = start_thread(process, &calls, function, argument, false)?;
        let result = wait_for_end(process, thread);
        // Let go of on a thread that lets itself go, however the wait ended: a thread still running lets itself go
        // when it ends.
        let _ = start_thread(process, &calls, calls.detach, thread, true);
        result
    }

    /// Finds the functions a call runs and takes the memory it uses (see [`Calls`]).
    fn prepare(process: &Process) -> Result<Calls> {
        let found = |symbol: &CStr| -> Result<u64> {
            process.system_function("libsystem_pthread.dylib", symbol)?.ok_or(Error::Call {
                reason: "the game has another build of the system's thread library than the editor",
            })
        };
        let (start, detach) = (found(c"pthread_create_from_mach_thread")?, found(c"pthread_detach")?);
        let area = process.allocate(AREA)?;
        // The attributes of a thread that lets itself go, as the system here lays them out: the process has the same
        // system library.
        let mut attributes: libc::pthread_attr_t = unsafe { std::mem::zeroed() };
        unsafe {
            libc::pthread_attr_init(&mut attributes);
            libc::pthread_attr_setdetachstate(&mut attributes, libc::PTHREAD_CREATE_DETACHED);
        }
        let bytes = unsafe {
            std::slice::from_raw_parts((&raw const attributes).cast::<u8>(), size_of::<libc::pthread_attr_t>())
        };
        let written = process.write_bytes(area + DETACHED, bytes);
        unsafe { libc::pthread_attr_destroy(&mut attributes) };
        written?;
        Ok(Calls { area, start, detach })
    }

    /// Starts a thread of the process's own that runs `function` with `argument`, one that lets itself go when it
    /// ends where `detached` says so, and gives back its handle (a `pthread_t`).
    fn start_thread(process: &Process, calls: &Calls, function: u64, argument: u64, detached: bool) -> Result<u64> {
        let handle_at = calls.area + HANDLE;
        process.write_bytes(handle_at, &0u64.to_le_bytes())?;
        // x0 to x3: pthread_create_from_mach_thread(&handle, attributes, function, argument); lr: 0.
        let attributes = if detached { calls.area + DETACHED } else { 0 };
        let mut registers = Registers::new();
        registers.__x[..4].copy_from_slice(&[handle_at, attributes, function, argument]);
        registers.__sp = calls.area + STACK_TOP;
        registers.__pc = calls.start;

        let faults = ExceptionPort::new()?;
        let mut thread = MACH_PORT_NULL;
        check(unsafe { thread_create(process.task(), &mut thread) }, "thread_create")?;
        let bare = BareThread(thread);
        let behavior = EXCEPTION_DEFAULT as i32;
        check(
            unsafe { thread_set_exception_ports(bare.0, FAULTS, faults.0, behavior, THREAD_STATE_NONE) },
            "thread_set_exception_ports",
        )?;
        let state = (&raw mut registers).cast();
        check(unsafe { thread_set_state(bare.0, ARM_THREAD_STATE64, state, Registers::count()) }, "thread_set_state")?;
        check(unsafe { thread_resume(bare.0) }, "thread_resume")?;

        let Some(fault) = faults.receive(CALL_WAIT)? else {
            // It may be in the middle of starting the new thread: it is left to finish, and its fault to wait at the
            // port, which is kept, rather than reach the process.
            std::mem::forget(bare);
            std::mem::forget(faults);
            return Err(Error::Call { reason: "the thread that starts it did not finish" });
        };
        // Answered with the bare thread suspended, so that it runs nothing more, and then ended.
        unsafe { thread_suspend(bare.0) };
        let mut stopped = Registers::new();
        let mut count = Registers::count();
        let read = check(
            unsafe { thread_get_state(bare.0, ARM_THREAD_STATE64, (&raw mut stopped).cast(), &mut count) },
            "thread_get_state",
        );
        fault.answer();
        drop(bare);

        read?;
        let ours = fault.0.thread.name == thread && fault.0.exception == EXC_BAD_ACCESS as i32;
        if !ours || stopped.__pc != 0 {
            return Err(Error::Call { reason: "the thread that starts it stopped elsewhere" });
        }
        // What pthread_create_from_mach_thread returned: 0, or an errno.
        if stopped.__x[0] as i32 != 0 {
            return Err(Error::Posix { op: "pthread_create_from_mach_thread", code: stopped.__x[0] as i32 });
        }
        match process.read_u64(handle_at)? {
            0 => Err(Error::Call { reason: "no thread was started" }),
            handle => Ok(handle),
        }
    }

    /// Waits for the thread `handle` to end, and gives back what its function returned.
    fn wait_for_end(process: &Process, handle: u64) -> Result<u64> {
        let since = Instant::now();
        while process.read_u32(handle + EXIT_GATE)? != ENDED {
            if since.elapsed() > CALL_WAIT {
                return Err(Error::Call { reason: "the function did not return" });
            }
            std::thread::sleep(Duration::from_millis(1));
        }
        process.read_u64(handle + EXIT_VALUE)
    }

    fn check(code: kern_return_t, op: &'static str) -> Result<()> {
        if code == KERN_SUCCESS { Ok(()) } else { Err(Error::Mach { op, code }) }
    }

    /// A bare thread the editor made in the process: ended and released on drop.
    struct BareThread(mach_port_t);

    impl Drop for BareThread {
        fn drop(&mut self) {
            unsafe {
                thread_terminate(self.0);
                mach_port_deallocate(mach_task_self(), self.0);
            }
        }
    }

    unsafe extern "C" {
        fn thread_terminate(thread: mach_port_t) -> kern_return_t;
    }

    /// A port of this process that gets the faults of a bare thread: a receive right with a send right, destroyed on
    /// drop.
    struct ExceptionPort(mach_port_t);

    impl ExceptionPort {
        fn new() -> Result<Self> {
            let task = unsafe { mach_task_self() };
            let mut port = MACH_PORT_NULL;
            check(unsafe { mach_port_allocate(task, MACH_PORT_RIGHT_RECEIVE, &mut port) }, "mach_port_allocate")?;
            let port = ExceptionPort(port);
            check(
                unsafe { mach_port_insert_right(task, port.0, port.0, MACH_MSG_TYPE_MAKE_SEND) },
                "mach_port_insert_right",
            )?;
            Ok(port)
        }

        /// The next fault reported at the port, or None after `wait`.
        fn receive(&self, wait: Duration) -> Result<Option<Fault>> {
            let mut message: FaultMessage = unsafe { std::mem::zeroed() };
            let code = unsafe {
                mach_msg(
                    &mut message.request.Head,
                    MACH_RCV_MSG | MACH_RCV_TIMEOUT,
                    0,
                    size_of::<FaultMessage>() as mach_msg_size_t,
                    self.0,
                    wait.as_millis() as u32,
                    MACH_PORT_NULL,
                )
            };
            match code {
                KERN_SUCCESS => {}
                MACH_RCV_TIMED_OUT => return Ok(None),
                code => return Err(Error::Mach { op: "mach_msg", code }),
            }
            let head = message.request.Head;
            let well_formed = head.msgh_id == EXCEPTION_RAISE
                && head.msgh_bits & MACH_MSGH_BITS_COMPLEX != 0
                && message.request.msgh_body.msgh_descriptor_count == 2;
            if !well_formed {
                unsafe { mach_msg_destroy(&mut message.request.Head) };
                return Err(Error::Call { reason: "its thread's fault was not one the editor understands" });
            }
            Ok(Some(Fault(message.request)))
        }
    }

    impl Drop for ExceptionPort {
        fn drop(&mut self) {
            let task = unsafe { mach_task_self() };
            unsafe {
                mach_port_deallocate(task, self.0);
                mach_port_mod_refs(task, self.0, MACH_PORT_RIGHT_RECEIVE, -1);
            }
        }
    }

    /// A fault's message as it is received, with room for the trailer the kernel appends.
    #[repr(C)]
    struct FaultMessage {
        request: __Request__exception_raise_t,
        trailer: [u8; 128],
    }

    /// A fault of a bare thread, waiting for its answer.
    struct Fault(__Request__exception_raise_t);

    impl Fault {
        /// Answers that the fault was dealt with, and releases the rights its message brought: the thread's and the
        /// task's.
        fn answer(&self) {
            let request = &self.0;
            let mut reply = __Reply__exception_raise_t {
                Head: mach_msg_header_t {
                    msgh_bits: MACH_MSGH_BITS(request.Head.msgh_bits & 0x1f, 0),
                    msgh_size: size_of::<__Reply__exception_raise_t>() as mach_msg_size_t,
                    msgh_remote_port: request.Head.msgh_remote_port,
                    msgh_local_port: MACH_PORT_NULL,
                    msgh_voucher_port: MACH_PORT_NULL,
                    msgh_id: request.Head.msgh_id + 100,
                },
                NDR: unsafe { NDR_record },
                RetCode: KERN_SUCCESS,
            };
            let task = unsafe { mach_task_self() };
            unsafe {
                mach_msg(
                    &mut reply.Head,
                    MACH_SEND_MSG | MACH_SEND_TIMEOUT,
                    size_of::<__Reply__exception_raise_t>() as mach_msg_size_t,
                    0,
                    MACH_PORT_NULL,
                    1000,
                    MACH_PORT_NULL,
                );
                mach_port_deallocate(task, request.thread.name);
                mach_port_deallocate(task, request.task.name);
                if request.Head.msgh_voucher_port != MACH_PORT_NULL {
                    mach_port_deallocate(task, request.Head.msgh_voucher_port);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::ffi::c_char;

    use super::*;

    #[test]
    fn finds_a_system_function_where_the_process_has_it() {
        let process = Process::open_read(std::process::id()).expect("open this process");
        let strdup = process.system_function("libsystem_c.dylib", c"strdup").expect("look");
        assert_eq!(strdup, Some(libc::strdup as unsafe extern "C" fn(*const c_char) -> *mut c_char as usize as u64));
        assert_eq!(process.system_function("libsystem_malloc.dylib", c"strdup").expect("look"), None);
        assert_eq!(process.system_function("libsystem_c.dylib", c"fmlibre_no_such_function").expect("look"), None);
    }

    #[cfg(target_arch = "aarch64")]
    extern "C" fn add_one(argument: u64) -> u64 {
        argument + 1
    }

    #[cfg(target_arch = "aarch64")]
    #[test]
    fn runs_a_function_of_the_process_on_a_thread_of_its_own() {
        let process = Process::open_read_write(std::process::id()).expect("open this process");
        assert!(process.can_call());
        let function = add_one as extern "C" fn(u64) -> u64 as usize as u64;
        assert_eq!(process.call(function, 41).expect("run it"), 42);
        // Again, in the memory the first call took.
        assert_eq!(process.call(function, u64::MAX - 1).expect("run it again"), u64::MAX);
        let read_only = Process::open_read(std::process::id()).expect("open this process");
        assert!(!read_only.can_call());
        assert!(matches!(read_only.call(function, 41), Err(Error::ReadOnly)));
    }

    #[cfg(target_arch = "aarch64")]
    #[test]
    fn takes_a_block_of_the_heap_with_the_process_strdup() {
        use std::ffi::{CString, c_void};

        let process = Process::open_read_write(std::process::id()).expect("open this process");
        let strdup = process.system_function("libsystem_c.dylib", c"strdup").expect("look").expect("strdup");
        let free = process.system_function("libsystem_malloc.dylib", c"free").expect("look").expect("free");
        let text = CString::new("FMLE a block of the heap").expect("text");
        let block = process.call(strdup, text.as_ptr() as u64).expect("strdup");
        assert_eq!(unsafe { CStr::from_ptr(block as *const c_char) }, text.as_c_str());
        // malloc's own block: it knows its size, and free() takes it back.
        assert!(unsafe { libc::malloc_size(block as *const c_void) } >= text.as_bytes_with_nul().len());
        process.call(free, block).expect("free");
    }

    #[cfg(not(target_arch = "aarch64"))]
    #[test]
    fn runs_nothing_off_apple_silicon() {
        let process = Process::open_read_write(std::process::id()).expect("open this process");
        assert!(!process.can_call());
        assert!(matches!(process.call(0x1000, 0), Err(Error::Call { .. })));
    }
}
