#text-file-spliter

Large text files branches split tool.

##Install

```
npm install text-file-spliter
```

##Methods

###start()

Began to split file

##Events

###filecreated

This event is triggered when a new file is split

###complete

After the completion of the file split trigger this event

##Example

```js
var TextFileSpliter = require('text-file-spliter'),
	spliter = new TextFileSpliter({
		//The file want to be split
		sourceFile : './data.txt',
		//The path to save splitted files
		targetPath : './out/',
		//The limit lines of split
		limit : 500000
	});


var start = Date.now();
spliter.on('complete', function (fileNum) {
	console.log('All Done');
	console.log('Takes ' + (Date.now() - start) + ' ms');
    console.log('Total of ' + fileNum + ' files generated');
});
spliter.on('filecreated', function (filename) {
    console.log('Created ' + filename);
});
spliter.start();
```


