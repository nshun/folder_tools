#! /usr/bin/env node

// ファイル名をcsv対応表を元に変更するスクリプトです。
// ex) cmd> node replace_filename.js {rootDir} {csvDir}
// ex) cmd> node replace_filename.js .\packages\AMGE .\replace.csv

'use strict';

const fs = require('fs');
const path = require('path');
const csv = require('csv');

// root dir, oldName -> newName
const rootDir = process.argv[2] || '.';
const csvPath = process.argv[3];

// 引数が足りないとき
if (process.argv.length < 4) {
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

function stat(filepath) {
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
				if (!files.length) fs.rmdir(dir, () => { });
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
		return fs.writeFile(path, string, 'utf8', err => {
			return err ? reject(err) : resolve();
		});
	});
}

function parseCSV(string) {
	return new Promise((resolve, reject) => {
		return csv.parse(string, (err, data) => {
			return err ? reject(err) : resolve(data);
		});
	});
}

// ファイルを再帰的に検索
async function fileSearcher(dirPath, fileCallback, errCallback) {
	try {
		const files = await readdir(dirPath);
		files.forEach(async file => {
			const filePath = path.join(dirPath, file);
			const stats = await stat(filePath);
			stats.isDirectory() ? fileSearcher(filePath, fileCallback) : fileCallback(filePath);
		});
	} catch (err) {
		errCallback(err);
	}
}

async function replace(dir, oldNameReg, newNameReg) {
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
		console.log('Receive err:' + err);
	});
}

// replace(rootDir, oldNameReg, newNameReg);

async function replaceFromCSV(dir, csvPath) {
	// csv読み込み
	const string = await readfile(csvPath);
	const table = await parseCSV(string);
	for (let row of table) {
		console.log(row[0] + ' -> ' + row[1]);
		await replace(dir, new RegExp(row[0], 'g'), row[1]);
	};
}

replaceFromCSV(rootDir, csvPath);
