# mp3-splitter

> Application to split up mp3 files

![Screenshot](screenshot.png)
![Screenshot 2](screenshot2.png)

#### Instructions
- Add files to be split (Can drag and drop file into window)
- Click `Split!` button to start
- Output will show files generated
- Click `Reset` the process over

#### Build Setup

Need `src-tauri/bin` files, such as:
- src-tauri/bin/ffmpeg-aarch64-apple-darwin
- src-tauri/bin/ffprobe-aarch64-apple-darwin

``` bash
# install dependencies
npm install

# serve with hot reload
npm run tauri dev

# build application for production
npm run tauri build
```

---
