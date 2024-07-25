const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function runCommand(command) {
    console.log(`Running command: ${command.join(' ')}`);
    try {
        const output = execSync(command.join(' '), { encoding: 'utf-8' });
        console.log(output);
    } catch (error) {
        console.error(`Error: ${error.stderr}`);
        throw new Error(`Command failed: ${command.join(' ')}`);
    }
}

function main() {
    const inputFile = "input.mp4";
    const outputDir = "output";
    fs.mkdirSync(outputDir, { recursive: true });

    // Paths to tools
    const ffmpegPath = "ffmpeg";
    const mp4fragmentPath = "mp4fragment";
    const mp4encryptPath = "mp4encrypt";
    const mp4dashPath = "mp4dash";

    // Step 1: Scale video and copy audio
    runCommand([ffmpegPath, "-i", inputFile, "-vf", "scale=1280:720", "-c:a", "copy", `${outputDir}/video_720.mp4`]);
    runCommand([ffmpegPath, "-i", inputFile, "-vf", "scale=854:480", "-c:a", "copy", `${outputDir}/video_480.mp4`]);
    runCommand([ffmpegPath, "-i", inputFile, "-vf", "scale=640:360", "-c:a", "copy", `${outputDir}/video_360.mp4`]);

    // Step 2: Fragment the videos
    runCommand([mp4fragmentPath, `${outputDir}/video_720.mp4`, `${outputDir}/fragmented_video_720.mp4`]);
    runCommand([mp4fragmentPath, `${outputDir}/video_480.mp4`, `${outputDir}/fragmented_video_480.mp4`]);
    runCommand([mp4fragmentPath, `${outputDir}/video_360.mp4`, `${outputDir}/fragmented_video_360.mp4`]);

    // Step 3: Encrypt the fragmented videos with CENC
    const encryptCommand = [
        mp4encryptPath,
        "--method", "MPEG-CENC",
        "--key", "1:87237D20A19F58A740C05684E699B4AA:random",
        "--property", "1:KID:A16E402B9056E371F36D348AA62BB749",
        "--key", "2:87237D20A19F58A740C05684E699B4AA:random",
        "--property", "2:KID:A16E402B9056E371F36D348AA62BB749",
        "--global-option", "mpeg-cenc.eme-pssh:true"
    ];

    runCommand([...encryptCommand, `${outputDir}/fragmented_video_720.mp4`, `${outputDir}/video_encrypted_720.mp4`]);
    runCommand([...encryptCommand, `${outputDir}/fragmented_video_480.mp4`, `${outputDir}/video_encrypted_480.mp4`]);
    runCommand([...encryptCommand, `${outputDir}/fragmented_video_360.mp4`, `${outputDir}/video_encrypted_360.mp4`]);

    // Step 4: Create DASH manifest and segments
    console.log(path.resolve(path.join(outputDir, "video_encrypted_720.mp4")));
    console.log("Output directory path:", outputDir);
    console.log("Checking if files exist...");

    const filesToCheck = ["video_encrypted_720.mp4", "video_encrypted_480.mp4", "video_encrypted_360.mp4"];
    filesToCheck.forEach(file => {
        const filePath = path.resolve(path.join(outputDir, file));
        if (!fs.existsSync(filePath)) {
            console.error(`Error: ${file} does not exist.`);
        }
    });

    console.log("mp4dash_path:", mp4dashPath);
    console.log("Current working directory:", process.cwd());

    runCommand([
        mp4dashPath,
        "-o", "stream",
        path.join(outputDir, "video_encrypted_720.mp4"),
        path.join(outputDir, "video_encrypted_480.mp4"),
        path.join(outputDir, "video_encrypted_360.mp4")
    ]);
}

main();