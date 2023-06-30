import { shell } from '@tauri-apps/api';

export function useFFmpeg(options) {
  let { log } = options;
  let ffmpeg: shell.Child;

  const spawn = async (args, outputFolder) => {
    const command = shell.Command.sidecar('bin/ffmpeg', args);
    command.on('close', data => {
      console.log(`command finished with code ${data.code} and signal ${data.signal}`);
    });
    command.on('error', error => console.error(`command error: "${error}"`));
    command.stdout.on('data', line => console.log(`command stdout: "${line}"`));
    command.stderr.on('data', line => console.log(`command stderr: "${line}"`));
    ffmpeg = await command.spawn();
  };

  const quit = () => {
    try {
      ffmpeg.kill();
    } catch (error) {
      log(error.message);
    }
  };

  return { spawn, quit };
}

export function useFFprobe(options) {
  let { log } = options;
  let ffmpeg: shell.Child;

  const spawn = async (args, outputFolder = null) => {
    const command = shell.Command.sidecar('bin/ffprobe', args);
    command.on('close', data => {
      // console.log(`command finished with code ${data.code} and signal ${data.signal}`);
      if (data.code !== 0) {
        console.log('error with command');
      }
    });
    command.on('error', error => console.error(`command error: "${error}"`));
    command.stdout.on('data', line => console.log(`command stdout: "${line}"`));
    command.stderr.on('data', line => console.log(`command stderr: "${line}"`));
    // command.execute();
    ffmpeg = await command.spawn();
  };

  const quit = () => {
    try {
      ffmpeg.kill();
    } catch (error) {
      log(error.message);
    }
  };

  return { spawn, quit };
}

function safePath(path: string): string {
  // return path.replaceAll(' ', '\\ ');
  // return `"${path}"`;
  return path;
}

function executeCommand(command: shell.Command) {
  return new Promise<string>(async (resolve, reject) => {
    command.on('close', data => {
      // console.log(`command finished with code ${data.code} and signal ${data.signal}`);
      if (data.code !== 0) {
        // console.log('error with non-zero code command');
        reject(new Error('Error with non-zero code command'));
      } else {
        resolve(null);
      }
    });
    command.on('error', error => {
      // console.error(`command error: "${error}"`);
      reject(new Error(`Command error: "${error}"`));
    });
    command.stdout.on('data', line => {
      // console.log(`command stdout: "${line}"`);
      resolve(line);
    });
    command.stderr.on('data', line => {
      // console.log(`command stderr: "${line}"`);
      reject(new Error(`Command error: "${line}"`));
    });
    command.execute();
  });
}

export async function getDuration(path): Promise<number> {
  // let ffprobe = useFFprobe({ log: (...args) => console.log(...args) }).spawn([
  //   ...ffprobeArgs,
  //   path,
  // ]);

  let ffprobeArgs =
    '-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1'.split(' ');
  const command = shell.Command.sidecar('bin/ffprobe', [...ffprobeArgs, safePath(path)]);
  return +(await executeCommand(command));
}

interface File {
  filename: string;
  folder: string;
  path: string;
  duration: number;
}

interface Settings {
  clipDuration: number;
  clipOverlap: number;
}

export async function splitFile(file: File, settings: Settings) {
  let minutesLeft = file.duration;
  let startTime = 0;
  let endTime = minutesLeft;
  let ranges: [number, number][] = [];
  // Convert minutes to seconds
  let clipDuration = settings.clipDuration * 60;
  let outputFiles: File[] = [];
  while (minutesLeft > clipDuration) {
    endTime = startTime + clipDuration;
    ranges.push([startTime, endTime]);
    minutesLeft -= clipDuration;
    startTime += clipDuration - settings.clipOverlap;
  }
  if (minutesLeft > 0) {
    ranges.push([startTime, file.duration]);
  }

  for (let seq = 1; seq <= ranges.length; seq++) {
    let parts = file.filename.split('.');
    let ext = parts.at(-1);
    let filename = `${parts.slice(0, -1)}-${seq}.${ext}`;
    let outputPath = `${file.folder}/${filename}`;
    let [startTime, endTime] = ranges[seq - 1];
    const args = `-v error -y -i ${safePath(
      file.path
    )} -ss ${startTime} -to ${endTime} -c copy ${safePath(outputPath)}`.split(' ');

    // const command = shell.Command.sidecar('bin/ffmpeg', args);
    // const command = shell.Command.sidecar('bin/ffmpeg', '-v error -h'.split(' '));
    const command = shell.Command.sidecar('bin/ffmpeg', args);
    const output = await executeCommand(command);
    outputFiles.push({
      duration: endTime - startTime,
      filename,
      folder: file.folder,
      path: output,
    });
  }
  return outputFiles;
}
