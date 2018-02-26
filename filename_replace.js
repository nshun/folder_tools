#! /usr/bin/env node

// ファイル名を変更するスクリプトです。
// 対象ディレクトリ内(サブフォルダ含)のhtmlファイルの中身も書き換えます
// 第二引数に対象のディレクトリ, 第三引数に元のファイル名, 第四引数に新しいファイル名を指定してください
// ex) cmd> node replace_filename.js {rootDir} {oldNameReg} {newNameReg}
// ex) cmd> node replace_filename.js .\packages\AMGE ([A-Z]*[0-9]*)_G(0[0-9]{2})\.(.*) $1_G1$2.$3
'use strict';

const fs = require('fs');
const path = require('path');

// root dir, oldName -> newName
const rootDir = process.argv[2] || '.';
const oldNameReg = new RegExp(process.argv[3], 'g');
const newNameReg = process.argv[4];

// 引数が足りないとき
if (process.argv.length < 5) {
    console.error('lack argument.');
    process.exit(1);
}

function readdir(dir, options) {
    return new Promise((resolve, reject) => {
        return fs.readdir(dir, options, (err, list) => {
            return err ? reject(err) : resolve(list);
        });
    });
}
function rmdir(dir, options) {
    return new Promise((resolve, reject) => {
        return fs.rmdir(dir, options, (err, list) => {
            return err ? reject(err) : resolve(list);
        });
    });
}

function stat(filepath, options) {
    return new Promise((resolve, reject) => {
        return fs.stat(filepath, (err, stats) => {
            return err ? reject(err) : resolve(stats);
        });
    });
}

function rename(oldPath, newPath) {
    return new Promise((resolve, reject) => {
        return fs.rename(oldPath, newPath, (err) => {
            if (err) return reject(err);
            const dir = path.dirname(oldPath);
            readdir(dir).then(files => {
                // ディレクトリが空になるなら削除
                if (!files.length) fs.rmdir(dir, err => { });
            });
            return resolve();
        });
    });
}

function readfile(path) {
    return new Promise((resolve, reject) => {
        return fs.readFile(path, 'utf8', (err, data) => {
            return err ? reject(err) : resolve(data);
        });
    });
}

function writefile(path, string) {
    return new Promise((resolve, reject) => {
        return fs.writeFile(path, string, 'utf8', (err) => {
            return err ? reject(err) : resolve();
        });
    });
}

// ファイルを再帰的に検索
async function fileSearcher(dirPath, fileCallback, errCallback) {
    const files = await readdir(dirPath);
    files.forEach(async file => {
        const filePath = path.join(dirPath, file);
        const stats = await stat(filePath);
        stats.isDirectory() ? fileSearcher(filePath, fileCallback) : fileCallback(filePath);
    });
};

function replace(dir, oldNameReg, newNameReg) {
    fileSearcher(dir, async filePath => {
        // HTML内を置換
        const baseName = path.basename(filePath);
        if (path.extname(baseName) === '.html') {
            const data = await readfile(filePath);
            if (oldNameReg.test(data)) {
                const result = data.replace(oldNameReg, newNameReg);
                await writefile(filePath, result);
                console.log('replaced in ' + filePath);
            }
        }
        // １個上のディレクトリ名とファイル名を置換
        if (oldNameReg.test(filePath)) {
            const oldDir = path.dirname(filePath);
            const newDir = oldDir.replace(oldNameReg, newNameReg);
            await stat(newDir).catch(() => fs.mkdirSync(newDir));
            const newName = baseName.replace(oldNameReg, newNameReg);
            const newPath = path.join(newDir, newName);
            await rename(filePath, newPath);
            console.log(filePath + ' -> ' + newPath);
        }
    }, err => {
        // errCallBack
        console.log("Receive err:" + err);
    });
};

replace(rootDir, oldNameReg, newNameReg);

