var fs = require('fs'),
	path = require('path'),
	util = require('util'),
	EventEmitter = require('events').EventEmitter;

var lineSplitor = 10;

function bufferCount(buf, data) {
    var i, size = buf.length,
        count = 0,
        list = [0];
    for (i = 0; i < size; i++) {
        if (buf[i] === data) {
            count++;
            list.push(i + 1);
        }
    }
    return {
        count : count,
        list : list
    };
}

/**
 * 大文本文件分行切割器
 * @param {Object} opts 设置参数
 * @param {String} opts.sourceFile 源文件路径
 * @param {String} opts.targetPath 切割文件保存目录
 * @param {Number} [opts.limit=100] 切割行数
 * @param {Number} [opts.maxStore] 每次读取源文件时的字节大小，单位KB
 */
function TextFileSpliter(opts) {
	opts = opts || {};
	this.$sourceFile = opts['sourceFile'];
	this.$targetPath = opts['targetPath'];
	this.$limit = opts['limit'] || 100;
    //this.$maxStore = (opts['maxStore'] || 16) * 1024;

	this._extName = path.extname(this.$sourceFile);
	this._baseName = path.basename(this.$sourceFile, this._extName);
	this._fileNum = 0;
	this._lineCount = 0;
	this._writeable = false;
	this._readable = false;
	this._readend = false;
	this._started = false;
    this._writedLine = 0;

	this._bufferInfo = null;
	this._writeFileName = null;
}

util.inherits(TextFileSpliter, EventEmitter);

/**
 * 设置读写状态
 * @param {String} rw 读写设置， 'r' 读取   'w' 写入
 * @param {Boolean} state 状态
 */
TextFileSpliter.prototype._setState = function (rw, state) {
	switch (rw) {
		case 'r':
			this._readable = state;
			break;
		case 'w':
			this._writeable = state;
            break;
        case 'e':
            this._readend = true;
	}
    if (this._writeable) {
        if (this._readable) {
            this._readChunk();
        } else if (this._readend) {
            this.emit('complete', this._fileNum);
        }
    }
};

/**
 * 读取数据
 */
TextFileSpliter.prototype._readChunk = function () {
    this._setState('r', false);
    this._setState('w', false);
	var writedLine = this._writedLine,
        chunk,
		chunks = [],
		size = 0,
		buf, lineCount;

	while ((chunk = this._readStream.read()) != null) {
		chunks.push(chunk);
		size += chunk.length;
	}
	buf = Buffer.concat(chunks, size);
	lineCount = bufferCount(buf, lineSplitor);

	this._bufferInfo = {
		buffer : buf,
		lineCount : lineCount,
		blockCount : Math.ceil((lineCount.count + writedLine) / this.$limit),
		blockNum : 0
	};
	this._toWrite();
};

/**
 * 分行写数据
 * @private
 */
TextFileSpliter.prototype._toWrite = function () {
	var writedLine = this._writedLine,
        bi = this._bufferInfo,
		blockNum = bi.blockNum,
		maxBlockNum = bi.blockCount - 1,
		lineCount = bi.lineCount.count,
        list = bi.lineCount.list,
        buffer = bi.buffer,
        limit = this.$limit,
		startLine, endLine, writeBuf, writeLineCount;

    if (blockNum <= maxBlockNum) {
        startLine = blockNum * limit - writedLine;
        startLine < 0 && (startLine = 0);
        endLine = (blockNum + 1) * limit - writedLine;
        if (blockNum === maxBlockNum) {
            writeLineCount = lineCount - startLine;
            this._writedLine = (lineCount + writedLine) > limit ? writeLineCount : lineCount + writedLine;
        } else {
            writeLineCount = endLine - startLine;
        }
        writeBuf = buffer.slice(list[startLine], list[endLine]);
        this._write(writeBuf, writeLineCount);
	} else {
        this._setState('w', true);
    }
};

/**
 * 创建文件写入流
 */
TextFileSpliter.prototype._createWriteStream = function () {
	this._writeStream && this._writeStream.end();
	this._writeFileName = (this._baseName + '_' + (this._fileNum++) + this._extName);
	this._writeStream = fs.createWriteStream(path.join(this.$targetPath, this._writeFileName));
    this.emit('filecreated', this._writeFileName);
};

/**
 * 将缓冲写入流
 * @param {Buffer} buf 缓冲数据
 * @param {Number} lineCount 写入行数
 */
TextFileSpliter.prototype._write = function (buf, lineCount) {
	this._writeStream.write(buf, function () {
		this._lineCount += lineCount;
		if (this._lineCount === this.$limit) {
			this._lineCount = 0;
			this._createWriteStream();
		}
		this._bufferInfo.blockNum++;
		this._toWrite();
	}.bind(this));
};

TextFileSpliter.prototype._onReadable = function () {
	this._setState('r', true);
};

TextFileSpliter.prototype._onEnd = function () {
    this._setState('e', true);
};

/**
 * 开始切割
 */
TextFileSpliter.prototype.start = function () {
	if (!this._started) {
		this._started = true;
		this._createWriteStream();
		this._setState('w', true);

        //暂不开放，对性能影响不大
		/*this._readStream = fs.createReadStream(this.$sourceFile, {
            highWaterMark : this.$maxStore
        });*/
        this._readStream = fs.createReadStream(this.$sourceFile);
		this._readStream.on('readable', this._onReadable.bind(this));
		this._readStream.on('end', this._onEnd.bind(this));
	}
};

module.exports = TextFileSpliter;