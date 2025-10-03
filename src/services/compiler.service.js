import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tmpDir = path.join(__dirname, "temp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

export function compileCode({ code, language }) {
  return new Promise((resolve, reject) => {
    const fileId = Date.now();
    let fileName, compileCmd;

    switch (language.toLowerCase()) {
      case "c":
        fileName = `${tmpDir}/${fileId}.c`;
        fs.writeFileSync(fileName, code);
        compileCmd = `gcc ${fileName} -o ${tmpDir}/${fileId}.out 2>&1`;
        break;

      case "cpp":
        fileName = `${tmpDir}/${fileId}.cpp`;
        fs.writeFileSync(fileName, code);
        compileCmd = `g++ ${fileName} -o ${tmpDir}/${fileId}.out -std=c++17 2>&1`;
        break;

      case "java":
        fileName = `${tmpDir}/Main_${fileId}.java`;
        fs.writeFileSync(fileName, code);
        compileCmd = `javac ${fileName} 2>&1`;
        break;

      case "python":
      case "javascript":
      case "typescript":
        // No compilation needed for these in local check
        return resolve({ success: true, message: "No compilation needed" });

      default:
        return reject("Unsupported language");
    }

    exec(compileCmd, (err, stdout, stderr) => {
      // Clean up files
      try {
        if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
        const outFile = `${tmpDir}/${fileId}.out`;
        if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
        if (language === "java") {
          const classFile = `${tmpDir}/Main_${fileId}.class`;
          if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
        }
      } catch (cleanupError) {
        console.log("Cleanup error:", cleanupError);
      }

      if (err || stderr) {
        resolve({ 
          success: false, 
          error: stderr || stdout,
          status: "COMPILATION_ERROR"
        });
      } else {
        resolve({ success: true, message: "Compilation successful" });
      }
    });
  });
}