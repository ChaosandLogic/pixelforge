//! Runtime-loaded Syphon.framework (Metal) for native GPU share on macOS.

#![allow(non_camel_case_types)]

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int, c_uchar};

#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn pf_syphon_load() -> c_int;
    fn pf_syphon_list(out: *mut c_char, cap: c_int) -> c_int;
    fn pf_syphon_receive(
        name: *const c_char,
        rgba: *mut *mut c_uchar,
        width: *mut c_int,
        height: *mut c_int,
    ) -> c_int;
    fn pf_syphon_free(ptr: *mut c_uchar);
    fn pf_syphon_publish(name: *const c_char, rgba: *const c_uchar, width: c_int, height: c_int) -> c_int;
}

#[cfg(target_os = "macos")]
pub fn load() -> Result<(), String> {
    unsafe {
        if pf_syphon_load() == 0 {
            Err("Syphon.framework not found".into())
        } else {
            Ok(())
        }
    }
}

#[cfg(target_os = "macos")]
pub fn list_senders() -> Vec<String> {
    let mut buf = vec![0i8; 8192];
    let n = unsafe { pf_syphon_list(buf.as_mut_ptr(), buf.len() as c_int) };
    if n <= 0 {
        return Vec::new();
    }
    let cstr = unsafe { CStr::from_ptr(buf.as_ptr()) };
    cstr.to_string_lossy()
        .split('\n')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect()
}

#[cfg(target_os = "macos")]
pub fn receive(name: &str) -> Option<(u32, u32, Vec<u8>)> {
    let c_name = CString::new(name).ok()?;
    let mut ptr: *mut c_uchar = std::ptr::null_mut();
    let mut w: c_int = 0;
    let mut h: c_int = 0;
    let ok = unsafe { pf_syphon_receive(c_name.as_ptr(), &mut ptr, &mut w, &mut h) };
    if ok == 0 || ptr.is_null() || w <= 0 || h <= 0 {
        return None;
    }
    let len = (w as usize) * (h as usize) * 4;
    let slice = unsafe { std::slice::from_raw_parts(ptr, len) };
    let data = slice.to_vec();
    unsafe { pf_syphon_free(ptr) };
    Some((w as u32, h as u32, data))
}

#[cfg(target_os = "macos")]
pub fn publish(name: &str, width: u32, height: u32, rgba: &[u8]) {
    let Ok(c_name) = CString::new(name) else { return };
    let _ = unsafe {
        pf_syphon_publish(
            c_name.as_ptr(),
            rgba.as_ptr(),
            width as c_int,
            height as c_int,
        )
    };
}
