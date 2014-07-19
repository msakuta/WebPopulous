
var canvas;
var width;
var height;
var stage;
var game;
var cursorPos = [0, 0];

var cursorSprite;

// Viewport origin
var vporg = [0, 0];
var vpw = 20, vph = 20; // Viewport sizes

window.onload = function(){
	canvas = document.getElementById("stage");
	width = parseInt(canvas.style.width);
	height = parseInt(canvas.style.height);

	stage = new createjs.Stage(canvas);
	stage.enableMouseOver();

	stage.on("mouseover", function(evt){
		cursorSprite.x = evt.stageX;
		cursorSprite.y = evt.stageY;
	});

	init();
}

var groundBaseTexture;

function init(){
	function calcPos(x,y){
		var cell = game.cellAt(x + vporg[0], y + vporg[1]);
		return [width / 2 + x * 16 - y * 16,
			height - 16 * 20 + x * 8 + y * 8 - cell.height * 8];
	}

	game = new PopGame(100, 100);

	groundBaseTexture = new createjs.SpriteSheet({
		images: ["assets/grass.png"],
		frames: {width: 32, height: 32, regX: 16, regY: 16},
	});

	var groundTexture = new createjs.Sprite(groundBaseTexture, 0);

	var ground = new createjs.Container();
	stage.addChild(ground);

	game.init();

	// Allocate viewport sprites
	var vpcells = Array(vpw * vph);
	function vp(x,y){return vpcells[x * vph + y];}
	var terrain = new createjs.Container();
	for(var x = 0; x < vpw; x++) for(var y = 0; y< vph; y++){
		var cell = vpcells[x * vph + y] = groundTexture.clone();
		var pos = calcPos(x, y);
		cell.x = pos[0];
		cell.y = pos[1];
		terrain.addChild(cell);
	}
	stage.addChild(terrain);

	// Plainly filled minimap
	var minimap = new createjs.Shape();
	minimap.graphics.beginFill("#00ff00").drawRect(0, 0, game.xs, game.ys);
	minimap.x = 20;
	minimap.y = 20;
	stage.addChild(minimap);

	// Viewport indicator
	var minimapVP = new createjs.Shape();
	minimapVP.graphics.setStrokeStyle(2,"round").beginStroke("#ffffff").drawRect(0, 0, vpw, vph);
	minimapVP.x = 20;
	minimapVP.y = 20;
	stage.addChild(minimapVP);

	// Having rectangle graphics for every cell in the game is so slow!
/*	var mmcells = Array(game.xs * game.ys);
	var minimap = new createjs.Container();
	for(var x = 0; x < game.xs/2; x++) for(var y = 0; y < game.ys/2; y++){
		var cell = mmcells[x * game.ys + y] = new createjs.Shape();
		cell.x = x + 20;
		cell.y = y + 20;
		cell.graphics.beginFill("#00ff00").drawRect(0, 0, 1, 1);
		minimap.addChild(cell);
	}
	stage.addChild(minimap);*/

	game.onUpdateCell = function(cell,x,y){
	}

	var cursorSpriteSheet = new createjs.SpriteSheet({
		images: ["assets/cursor.png"],
		frames: {width: 8, height: 8, regX: 4, regY: 4},
	});
	cursorSprite = new createjs.Sprite(cursorSpriteSheet, 0);
	stage.addChild(cursorSprite);

	var overlay = new createjs.Container();

//	stage.addChild(overlay);
	requestAnimationFrame(animate);

	// Variable to remember the last time of animation frame.
	var lastTime = null;

//	createjs.Ticker.addEventListener("tick", animate);
	function animate(timestamp) {
		// Calculate the delta-time of this frame for game update process.
		if(lastTime === null)
			lastTime = timestamp;
		var deltaTime = timestamp - lastTime;
		lastTime = timestamp;

		game.update(deltaTime);

		for(var x = 0; x < vpw; x++) for(var y = 0; y < vph; y++){
			gx = x + vporg[0];
			gy = y + vporg[1];
			var sid = game.slopeID(gx, gy);
			vp(x,y).gotoAndStop(sid);
			var pos = calcPos(x, y);
			vp(x,y).y = pos[1] - (sid & 1 ? 8 : 16);
		}
		var pos = calcPos(cursorPos[0] - vporg[0], cursorPos[1] - vporg[1]);
		cursorSprite.x = pos[0];
		cursorSprite.y = pos[1] - 16;
		document.getElementById("poslabel").value = "" + cursorPos[0] + ", " + cursorPos[1]
			+ ", " + pos[0] + ", " + pos[1] + ", " + game.cellAt(cursorPos[0], cursorPos[1]).height;

		minimapVP.x = 20 + vporg[0];
		minimapVP.y = 20 + vporg[1];

		stage.update();

		// Drawing minimap pixels by pixel is so slow
/*		var context = canvas.getContext("2d");
		var image = context.getImageData(20, 20, game.xs, game.ys);

		var pixels = game.xs * game.ys;
		var imageData = image.data; // here we detach the pixels array from DOM
		for(var x = 0; x < game.xs; x++) for(var y = 0; y < game.ys; y++){
			var pixels = x * game.ys + y;
			var sid = game.slopeID(x, y);
		   imageData[4*pixels+0] = 0; // Red value
		   imageData[4*pixels+1] = sid & 1 ? 127 : 255; // Green value
		   imageData[4*pixels+2] = 0; // Blue value
		   imageData[4*pixels+3] = 255; // Alpha value
		}
		image.data = imageData; // And here we attache it back (not needed cf. update)
		context.putImageData(image, 20, 20);*/

		requestAnimationFrame(animate);
	}
}

function reset(){
	if(confirm("Are you sure to reset progress?")){
		localStorage.removeItem("PopGameSave");

		// We want to use clearAll(), but PIXI.Stage does not officially support it.
		// At least we want removeChildAt() or something...
		while(stage.children.length != 0)
			stage.removeChild(stage.getChildAt(0));

		init();
	}
}

document.onkeydown = function(event){
	if(event.keyCode == 80){
		game.pause = !game.pause;
	}
	else if(event.keyCode == 65){ // 'a'
		if(0 < cursorPos[0]){
			cursorPos[0]--;
			if(cursorPos[0] < vporg[0])
				vporg[0] = cursorPos[0];
		}
	}
	else if(event.keyCode == 68){ // 'd'
		if(cursorPos[0] < game.xs-1){
			cursorPos[0]++;
			if(vporg[0] <= cursorPos[0] - vpw)
				vporg[0] = cursorPos[0] - vpw;
		}
	}
	else if(event.keyCode == 87){ // 'w'
		if(0 < cursorPos[1]){
			cursorPos[1]--;
			if(cursorPos[1] < vporg[1])
				vporg[1] = cursorPos[1];
		}
	}
	else if(event.keyCode == 83){ // 's'
		if(cursorPos[1] < game.ys-1){
			cursorPos[1]++;
			if(vporg[1] <= cursorPos[1] - vph)
				vporg[1] = cursorPos[1] - vph;
		}
	}
	else if(event.keyCode == 81){ // 'q'
		console.log("raised cost: " + game.raiseTerrain(cursorPos[0], cursorPos[1], 1));
	}
	else if(event.keyCode == 90){ // 'z'
		console.log("lowered cost: " + game.raiseTerrain(cursorPos[0], cursorPos[1], -1));
	}
}
