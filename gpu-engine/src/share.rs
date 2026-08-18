use std::collections::HashMap;

pub struct ShareHub {
    pub error: Option<String>,
    platform: &'static str,
    last_frames: HashMap<String, (u32, u32, Vec<u8>)>,
}

impl ShareHub {
    pub fn new() -> Self {
        let (platform, error) = native_platform();
        Self {
            error,
            platform,
            last_frames: HashMap::new(),
        }
    }

    pub fn platform_name(&self) -> &'static str {
        self.platform
    }

    pub fn available(&self) -> bool {
        self.platform != "none"
    }

    pub fn list_senders(&self) -> Vec<String> {
        native_list()
    }

    pub fn receive(&mut self, sender: &str) -> Option<(u32, u32, Vec<u8>)> {
        if sender.is_empty() {
            return None;
        }
        if let Some(frame) = native_receive(sender) {
            self.last_frames.insert(sender.to_string(), frame.clone());
            return Some(frame);
        }
        self.last_frames.get(sender).cloned()
    }

    pub fn publish(&mut self, name: &str, width: u32, height: u32, rgba: &[u8]) {
        native_publish(name, width, height, rgba);
    }
}

fn native_platform() -> (&'static str, Option<String>) {
    #[cfg(target_os = "macos")]
    {
        match crate::syphon::load() {
            Ok(()) => ("syphon", None),
            Err(e) => ("none", Some(e)),
        }
    }
    #[cfg(target_os = "windows")]
    {
        ("none", None)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        ("none", None)
    }
}

fn native_list() -> Vec<String> {
    #[cfg(target_os = "macos")]
    {
        crate::syphon::list_senders()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Vec::new()
    }
}

fn native_receive(sender: &str) -> Option<(u32, u32, Vec<u8>)> {
    #[cfg(target_os = "macos")]
    {
        crate::syphon::receive(sender)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = sender;
        None
    }
}

fn native_publish(name: &str, width: u32, height: u32, rgba: &[u8]) {
    #[cfg(target_os = "macos")]
    {
        crate::syphon::publish(name, width, height, rgba);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (name, width, height, rgba);
    }
}
