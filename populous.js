
var canvas;
var minimapCanvas;
var width;
var height;
var stage;
var game;
var cursorPos = [0, 0];

var cursorSprite;

// Viewport origin
var vporg = [0, 0];
var vpw = 20, vph = 20; // Viewport sizes

function vprect(){
	function addMethod(s, n, m){
		s.prototype[n] = m;
		return s;
	}
	function _Rect(x0,y0,x1,y1){
		this.x0 = x0;
		this.y0 = y0;
		this.x1 = x1;
		this.y1 = y1;
	}
	_Rect.prototype.intersects = function(x,y){
		return this.x0 <= x && x < this.x1 && this.y0 <= y && y < this.y1;
	}
	return new _Rect(vporg[0], vporg[1], vporg[0] + vpw, vporg[1] + vph);
}

window.onload = function(){
	canvas = document.getElementById("stage");
	canvas.oncontextmenu = function(){return false;};
	minimapCanvas = document.getElementById("minimap");
	width = parseInt(canvas.style.width);
	height = parseInt(canvas.style.height);

	stage = new createjs.Stage(canvas);
	stage.enableMouseOver();

	init();
}

var groundBaseTexture;
var manTexture;

function init(){
	function calcPos(x,y){
		var cell = game.cellAt(Math.floor(x + vporg[0]), Math.floor(y + vporg[1]));
		return [width / 2 + x * 16 - y * 16,
			height - 16 * 20 + x * 8 + y * 8 - cell.height * 8];
	}

	function clientToLogical(apos){
		var pos = [apos[0], apos[1]];
		pos[0] -= width / 2;
		pos[1] -= height - 16 * 20 - 16;
		var ret = [
			Math.floor((pos[0] / 2 + pos[1]) / 16 + vporg[0]),
			Math.floor((pos[1] - pos[0] / 2) / 16 + vporg[1])
		];
		if(ret[0] < vporg[0]) ret[0] = vporg[0];
		else if(vporg[0] + vpw <= ret[0]) ret[0] = vporg[0] + vpw;
		if(ret[1] < vporg[1]) ret[1] = vporg[1];
		else if(vporg[1] + vph <= ret[1]) ret[1] = vporg[1] + vph;
		return ret;
	}

	// Cursor position update by mouse position
	stage.on("stagemousemove", function(evt){
		var pos = clientToLogical([evt.stageX, evt.stageY]);
		cursorPos = pos;
	});

	game = new PopGame(100, 100);

	groundBaseTexture = new createjs.SpriteSheet({
		images: ["assets/grass.png"],
		frames: {width: 32, height: 48, regX: 16, regY: 32},
		animations: {ocean: [15,18,"ocean",0.1], house: [19]},
	});

	var flagTexture = new createjs.SpriteSheet({
		images: ["assets/flag.png"],
		frames: {width: 8, height: 8, regX: 0, regY: 8},
		animations: {flow: [0,3,"flow",0.1]},
	});

	manTexture = new createjs.SpriteSheet({
		images: ["assets/man.png"],
		frames: {width: 32, height: 32, regX: 16, regY: 48},
		animations: {
			right: [2,3,"right",0.5],
			stand: [0],
			forward: [6,7,"forward",0.5],
			back: [10,11,"back",0.5]
		},
	});

	var groundTexture = new createjs.Sprite(groundBaseTexture, 0);
	groundTexture.mouseEnabled = false;

	var ground = new createjs.Container();
	stage.addChild(ground);

	game.init();

	// Hit shape for the terrain
	var cursorHitShape = new createjs.Shape();
	cursorHitShape.graphics.beginFill("#fff");
	var polys = [[-3,-3],[vpw-3,-3],[vpw,0],[vpw,vph],[0,vph],[-3,vph-3]];
	for(var i = 0; i < polys.length; i++){
		var pos = calcPos(polys[i][0],polys[i][1]);
		cursorHitShape.graphics.lt(pos[0],pos[1]-16);
	}
	cursorHitShape.on("mousedown", function(evt){
		var delta = evt.nativeEvent.button === 2 ? -1 : 1;
		console.log("raised cost: " + game.raiseTerrain(cursorPos[0], cursorPos[1], delta));
	});
	stage.addChild(cursorHitShape);

	// Allocate viewport sprites
	var vpcells = Array(vpw * vph);
	function vp(x,y){return vpcells[x * vph + y];}
	var terrain = new createjs.Container();
	for(var x = 0; x < vpw; x++) for(var y = 0; y< vph; y++){
		var cell = vpcells[x * vph + y] = new createjs.Container();
		cell.sprite = groundTexture.clone();
		cell.addChild(cell.sprite);
		var pos = calcPos(x, y);
		cell.x = pos[0];
		cell.y = pos[1];
		cell.gamex = x; // Remember its position for events
		cell.gamey = y;
		terrain.addChild(cell);
	}
	stage.addChild(terrain);

	// Placeholder bitmap for procedurally generated minimap
	var minimap = new createjs.Bitmap();
	minimap.x = 20;
	minimap.y = 20;
	function minimapMove(evt){
		function clamp(s, ma, mi){
			return s < mi ? mi : ma < s ? ma : s;
		}
		vporg[0] = Math.floor(clamp(evt.stageX - minimap.x - vpw / 2, game.xs - vpw, 0));
		vporg[1] = Math.floor(clamp(evt.stageY - minimap.y - vph / 2, game.ys - vph, 0));
		cursorPos[0] = clamp(cursorPos[0], vporg[0] + vpw, vporg[0]);
		cursorPos[1] = clamp(cursorPos[1], vporg[1] + vph, vporg[1]);
		evt.stopPropagation();
	}
	minimap.on("mousedown", minimapMove);
	minimap.on("pressmove", minimapMove);
	stage.addChild(minimap);

	// Viewport indicator
	var minimapVP = new createjs.Shape();
	minimapVP.graphics.setStrokeStyle(2,"round").beginStroke("#ffffff").drawRect(0, 0, vpw, vph);
	minimapVP.x = 20;
	minimapVP.y = 20;
	stage.addChild(minimapVP);

	var unitContainer = new createjs.Container();
	stage.addChild(unitContainer);

	game.onUpdateCell = function(cell,x,y){
	}

//	game.onUpdateUnit = {};

	game.onDeleteUnit = function(u){
		if(u.graphic)
			u.graphic.parent.removeChild(u.graphic);
	};

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

	var frameCount = 0;

	function paintMinimap(y0,ys){
		var context = minimapCanvas.getContext("2d");
		var image = context.getImageData(0, y0, game.xs, ys);

		var pixels = game.xs * game.ys;
		var imageData = image.data; // here we detach the pixels array from DOM
		var land = [0, 127, 0],
		    left = [0, 159, 0], right = [0, 91, 0], up = [0, 191, 0], down = [0, 63, 0],
		    ocean = [14,39,214];
		var cols = [
			land, down, left, down,
			right, down, right, down,
			up, left, up, left,
			up, right, up, land
		];
		for(var y = y0; y < y0 + ys; y++) for(var x = 0; x < game.xs; x++){
			var pixels = (y - y0) * game.xs + x;
			var sid = game.slopeID(x, y);
			var col = sid === 0 && game.cellAt(x, y).height === 0 ? ocean : cols[sid];
			imageData[4*pixels+0] = col[0]; // Red value
			imageData[4*pixels+1] = col[1]; // Green value
			imageData[4*pixels+2] = col[2]; // Blue value
			imageData[4*pixels+3] = 255; // Alpha value
		}
//		image.data = imageData; // And here we attache it back (not needed cf. update)
		context.putImageData(image, 0, y0);
	}

	function paintWalls(x,y,gx,gy,cell){
		if(cell.type !== "house" && game.isFlat(gx,gy)){
			var adjacents = 0;
			var mx = Math.min(gx+1, game.xs-2);
			var dx, dy;
			for(var xx = Math.max(gx-1, 0); xx <= mx; xx++){
				for(var yy = Math.max(gy-1, 0); yy <= Math.min(gy+1, game.ys-2); yy++){
					if(game.cellAt(xx, yy).type === "house"
					   && 8 <= (adjacents = game.cellAt(xx, yy).farms)){
						dx = gx - xx;
						dy = gy - yy;
						break;
					}
				}
			}
			if(8 < adjacents){
				if(!vp(x,y).wall){
					vp(x,y).wall = groundTexture.clone();
					vp(x,y).addChild(vp(x,y).wall);
				}
				var wallIdx = (dx + dy + 4) % 2 === 0 ? 0 : Math.abs(dx) < Math.abs(dy) ? 1 : 2;
				if(48 <= adjacents)
					wallIdx += 6;
				else if(24 < adjacents)
					wallIdx += 3;
				vp(x,y).wall.gotoAndStop(27 + wallIdx);
	//			vp(x,y).wall.x = vp(x,y).x;
	//			vp(x,y).wall.y = vp(x,y).y;
				return;
			}
		}
		if(vp(x,y).wall !== undefined){
			vp(x,y).removeChild(vp(x,y).wall);
			vp(x,y).wall = undefined;
		}
	}

//	createjs.Ticker.addEventListener("tick", animate);
	function animate(timestamp) {
		// Calculate the delta-time of this frame for game update process.
		if(lastTime === null)
			lastTime = timestamp;
		var deltaTime = timestamp - lastTime;
		lastTime = timestamp;

		game.update(Math.min(deltaTime, 1000));
		
		var oceanFrame = 15 + Math.floor(timestamp / 500 % 4);
		var flagFrame = Math.floor(timestamp / 200 % 4);

		for(var x = 0; x < vpw; x++) for(var y = 0; y < vph; y++){
			gx = x + vporg[0];
			gy = y + vporg[1];
			var sid = game.slopeID(gx, gy);
			var cell = game.cellAt(gx, gy);
			if(sid === 0 && cell.height === 0)
				vp(x,y).sprite.gotoAndStop(oceanFrame);
			else if(sid === 0 && cell.type === "house"){
				var farms = cell.farms;
				var hi = farms < 8 ? farms / 2 : farms < 24 ? 4 : farms < 48  ? 5 : 6;
				vp(x,y).sprite.gotoAndStop(19 + hi);
				if(!vp(x,y).flag){
					vp(x,y).flag = new createjs.Sprite(flagTexture, 0);
					terrain.addChild(vp(x,y).flag);
				}
				vp(x,y).flag.gotoAndStop(flagFrame);
				vp(x,y).flag.x = vp(x,y).x + 8;
				vp(x,y).flag.y = vp(x,y).y - cell.amount * 32 / cell.getCapacity() + 16;
			}
			else if(sid === 0 && cell.type === "farm"){
				// Filters don't work well for coloring farms
				vp(x,y).sprite.gotoAndStop(26);
			}
			else
				vp(x,y).sprite.gotoAndStop(sid);

			paintWalls(x,y,gx,gy,cell);

			if(cell.type !== "house" && vp(x,y).flag){
				terrain.removeChild(vp(x,y).flag);
				vp(x,y).flag = undefined;
			}

			var pos = calcPos(x, y);
			vp(x,y).y = pos[1] - (sid & 1 ? 8 : 16);
		}
		var pos = calcPos(cursorPos[0] - vporg[0], cursorPos[1] - vporg[1]);
		cursorSprite.x = pos[0];
		cursorSprite.y = pos[1] - 16;
		document.getElementById("poslabel").value = "" + cursorPos[0] + ", " + cursorPos[1]
			+ ", " + pos[0] + ", " + pos[1] + ", " + game.cellAt(cursorPos[0], cursorPos[1]).height;

		for(var i = 0; i < game.units.length; i++){
			var unit = game.units[i];
			if(!vprect().intersects(unit.x, unit.y)){
				if(unit.graphic)
					unit.graphic.visible = false;
				continue;
			}
			if(!unit.graphic){
				unit.graphic = new createjs.Sprite(manTexture, 0);
				unitContainer.addChild(unit.graphic);
			}
			var pos = calcPos(unit.x - vporg[0], unit.y - vporg[1]);
			unit.graphic.x = pos[0];
			unit.graphic.y = pos[1];
			unit.graphic.visible = true;
		}

		minimapVP.x = 20 + vporg[0];
		minimapVP.y = 20 + vporg[1];

		stage.update();

		// Drawing minimap pixels by pixel is so slow
		if(frameCount === 0){
			paintMinimap(0, game.ys);
		}
		else{
			var y = frameCount % game.xs;
			paintMinimap(y, 1);
		}

		if(frameCount % game.ys === 0){
			var image = new Image();
			image.src = minimapCanvas.toDataURL("image/png");
//			console.log(image.src);
			image.onload = function(){ minimap.image = image };
		}
		frameCount++;

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
