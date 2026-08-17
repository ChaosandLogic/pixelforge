fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("apple") || cfg!(target_os = "macos") {
        println!("cargo:rerun-if-changed=native/syphon_bridge.m");
        cc::Build::new()
            .file("native/syphon_bridge.m")
            .flag("-fobjc-arc")
            .compile("syphon_bridge");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=AppKit");
        println!("cargo:rustc-link-lib=framework=Metal");
    }
}
