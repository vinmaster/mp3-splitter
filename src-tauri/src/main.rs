// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::path::PathBuf;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_filename(path: &str) -> String {
    let path_buf = PathBuf::from(path);
    let filename = path_buf.file_name().unwrap();
    return String::from(filename.to_str().unwrap());
}

#[tauri::command]
fn get_folder(path: &str) -> String {
    let path_buf = PathBuf::from(path);
    let dir = path_buf.parent().unwrap();
    return String::from(dir.to_str().unwrap());
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, get_filename, get_folder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
