
var width;
var height;
var stage;
var game;
var cursorPos = [0, 0];

var cursorSprite;

window.onload = function(){
	var canvas = document.getElementById("stage");
	width = parseInt(canvas.style.width);
	height = parseInt(canvas.style.height);

	stage = new createjs.Stage("stage");
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
		var cell = game.cellAt(x, y);
		return [width / 2 + x * 16 - y * 16,
			height - 16 * 20 + x * 8 + y * 8 - cell.height * 8];
	}

	game = new PopGame(20, 20);

	groundBaseTexture = new createjs.SpriteSheet({
		images: ["assets/grass.png"],
		frames: {width: 32, height: 32, regX: 16, regY: 16},
	});

	var groundTexture = new createjs.Sprite(groundBaseTexture, 0);

	var ground = new createjs.Container();
	stage.addChild(ground);

	game.init();

	game.onUpdateCell = function(cell,x,y){
		if(cell.graphics == undefined){
			cell.graphics = new createjs.Container();

			ground.addChild(cell.graphics);
		}
		if(cell.gs == undefined){
			var groundSprite = groundTexture.clone();
			cell.graphics.addChild(groundSprite);
			cell.gs = groundSprite;
		}
		var sid = this.slopeID(x, y);
		cell.gs.gotoAndStop(/*this.isFlat(x, y) ? 0 : */sid);
		var pos = calcPos(x, y);
		cell.gs.x = pos[0];
		cell.gs.y = pos[1] - (sid & 1 ? 8 : 16);
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

		var pos = calcPos(cursorPos[0], cursorPos[1]);
		cursorSprite.x = pos[0];
		cursorSprite.y = pos[1] - 16;
		document.getElementById("poslabel").value = "" + cursorPos[0] + ", " + cursorPos[1]
			+ ", " + pos[0] + ", " + pos[1] + ", " + game.cellAt(cursorPos[0], cursorPos[1]).height;

		stage.update();

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
		cursorPos[0]--;
	}
	else if(event.keyCode == 68){ // 'd'
		cursorPos[0]++;
	}
	else if(event.keyCode == 87){ // 'w'
		cursorPos[1]--;
	}
	else if(event.keyCode == 83){ // 's'
		cursorPos[1]++;
	}
	else if(event.keyCode == 81){ // 'q'
		console.log("raised const: " + game.raiseTerrain(cursorPos[0], cursorPos[1], 1));
	}
	else if(event.keyCode == 90){ // 'z'
		console.log("lowered const: " + game.raiseTerrain(cursorPos[0], cursorPos[1], -1));
	}
}
