
/// Utility function
function clamp(s, ma, mi){
	return s < mi ? mi : ma < s ? ma : s;
}

function veclen(v){
	return Math.sqrt(v[0]*v[0] + v[1]*v[1]);
}

function vecnorm(v){
	var len = veclen(v);
	return [v[0] / len, v[1] / len];
}


function PopGame(xs,ys){
	this.xs = xs;
	this.ys = ys;
	this.rng = new Xor128();

	this.cells = Array(xs * ys);

	this.units = [new PopGame.Unit(this,4,5,500), new PopGame.Unit(this,5,5,500)];

	this.pause = false;
	this.time = 0;
	this.frameCount = 0;
}

PopGame.Cell = function(height){
	this.height = height;
}

PopGame.Cell.prototype.update = function(game,x,y,dt){
	if(this.type === "house"){
		this.amount = clamp(this.amount * (1. + dt / 50000), this.getMaxAmount(), 0);
		if(this.getMaxAmount() === this.amount){
			game.units.push(new PopGame.Unit(game, x, y, this.amount / 2.));
			this.amount /= 2.;
		}
	}
}

PopGame.Cell.prototype.getGrowth = function(){
}

PopGame.Cell.prototype.getMaxAmount = function(){
	return 1000;
}

PopGame.Unit = function(game,x,y,health=100){
	this.game = game;
	this.health = health;
	this.x = x;
	this.y = y;
	this.dst = null;
}

PopGame.Unit.prototype.update = function(dt){

	var ix = Math.floor(this.x), iy = Math.floor(this.y);

	// Merge two units if they get close enough to each other.
	for(var i = 0; i < this.game.units.length; i++){
		var u = this.game.units[i];
		if(u !== this && Math.floor(u.x) === ix && Math.floor(u.y) === iy){
			u.health += this.health;
			return false;
		}
	}

	// environment damage
	var v = this.health < 500 ? 5 : this.health / 100;
	this.health -= v * dt / 1000;
	if(this.health <= 0){
//		pu->active = 0;
//		pg->pl[pu->team].starveds++;
//		g_logdata.players[pu->team].starveds++;
		return false;
	}

	// If we have destination set, approach there.
	if(this.dst){
		// We have reached our destination.
		if(ix === this.dst[0] && iy === this.dst[1])
			this.dst = null;
		else{
			var n = vecnorm([this.dst[0] - this.x, this.dst[1] - this.y]);
			this.x += n[0] * dt / 1000;
			this.y += n[1] * dt / 1000;
		}
	}
	else{
		// Find suitable place to build a new house.
		var vacancy = null;
		var scope = this;
		var game = this.game;
		var best = 10 * 10;
		this.game.forAdjacents(ix, iy, this.game.xs-2, this.game.ys-2, 3 * 2,
			function(x,y){
				var cell = game.cellAt(x,y);
				if(game.isFlat(x,y) && 0 < cell.height && !cell.type){
					var dist = veclen([scope.x - x, scope.y - y]);
					if(dist < best){
						best = dist;
						vacancy = [x,y];
					}
				}
				return true;
			});
		if(vacancy)
			this.dst = vacancy;
		else{
			// If we have nowhere to go, randomly walk around.
			this.x += dt / 1000. * (this.game.rng.next() - 0.5);
			this.y += dt / 1000. * (this.game.rng.next() - 0.5);
		}
	}

	var cell = this.game.cellAt(ix, iy);
	if(this.game.isFlat(ix, iy) && 0 < cell.height && !cell.type){
		cell.type = "house";
		cell.amount = this.health;
		this.game.updateHouse(ix, iy);
		return false;
	}
	return true;
}


PopGame.prototype.init = function(){
//	if(typeof(Storage) !== "undefined"){
//		this.deserialize(localStorage.getItem("PopGameSave"));
//	}
//	else
	{
		for(var x = 0; x < this.xs; x++){
			for(var y = 0; y < this.ys; y++){
				var vx = x - 5;
				var vy = y - 5;
				var height = vx * vx + vy * vy < 3 * 3 ? 2 : vx * vx + vy * vy < 5 * 5 ? 1 : 0;
				var cell = new PopGame.Cell(height);

				this.onUpdateCell(cell,x,y);

				this.cells[x * this.ys + y] = cell;
			}
		}
	}
}

PopGame.prototype.cellAt = function(x,y){
	if(x < 0 || this.xs <= x || y < 0 || this.ys <= y || this.cells.length <= x * this.ys + y)
		return new PopGame.Cell(0);
	return this.cells[Math.floor(x) * this.ys + Math.floor(y)];
}

PopGame.prototype.isFlat = function(x,y){
	var c = this.cellAt(x, y);
	var cr = this.cellAt(x+1, y);
	var cd = this.cellAt(x, y+1);
	var crd = this.cellAt(x+1, y+1);
	return cr && cr.height === c.height
		&& cd && cd.height === c.height
		&& crd && crd.height === c.height;
}

/* Bit index
     -> x
 |  0---1
 V  |   |
 y  2---3

*/
PopGame.prototype.slopeID = function(x,y){
	if(x < 0 || this.xs <= x || y < 0 || this.ys <= y){
//		console.log("ob: %d, %d [%d, %d]\n", x, y, this.cells.length-1, this.cells[0].length-1);
		return 0;
	}
	var maxh = 0;
	var minh = 127;
	for(var xx = x; xx <= x+1; xx++) for(var yy = y; yy <= y+1; yy++){
		var h = this.cellAt(xx, yy).height;
		if(maxh < h)
			maxh = h;
		if(h < minh)
			minh = h;
	}
	if(minh + 1 < maxh)
		return 0xf;
	var ret = (this.cellAt(x, y).height - minh ? 1 : 0)
		| (this.cellAt(x+1, y).height - minh ? 2 : 0)
		| (this.cellAt(x, y+1).height - minh ? 4 : 0)
		| (this.cellAt(x+1, y+1).height - minh ? 8 : 0);
//	console.log("min = %d, max = %d, %d\n", minh, maxh, ret);
	return ret;
}


PopGame.prototype.onUpdateCell = function(cell,x,y){}

PopGame.prototype.onUpdateUnit = function(unit){}

PopGame.prototype.onDeleteUnit = function(unit){}

PopGame.prototype.update = function(deltaTime){
	if(this.pause)
		return;
	var frameTime = 100; // Frame time interval in milliseconds
	this.time += deltaTime;

	// Repeat the frame procedure in constant interval.
	while(frameTime < this.time){

		this.updateInternal(frameTime);

		this.time -= frameTime;
		this.frameCount++;
	}
}

/// \brief Modifies the terrain
/// \param delta The amount to raise or lower the terrain. Can be negative for lowering.
/// \returns Amount of soils removed or added for the terrain modification. Can be negative
///          for lowering operation.
PopGame.prototype.raiseTerrain = function(x,y,delta){
	if(x < 0 || this.xs <= x || y < 0 || this.yx <= y)
		return 0;
	var cell = this.cellAt(x, y);
	if(cell.height + delta < 0) // Clip lowering
		delta = -cell.height;
	cell.height += delta;
	return this.levelModify(x, y) + delta;
}

PopGame.prototype.levelModify = function(x,y){
	function levelModifyInt(x0, y0, x, y){
		var c = this.cellAt(x, y);
		var h0 = this.cellAt(x0, y0).height;
		var delta = c.height - h0;
	/*	printf("(%d,%d)%d - (%d,%d)%d = %d\n", x, y, *ph, x0, y0, h0, delta);*/
		var cdelta = clamp(delta, 1, -1);
		if(cdelta !== delta){
			var rdelta = (h0 + cdelta) - c.height;
			c.height = h0 + cdelta;
			this.levelInvokes++;
/*			if(pp){
				pp->mana -= LEVEL_COST;
				if(0 <= pp->clays + delta && pp->clays + delta < pp->maxclays) pp->clays += delta;
			}*/
			return this.levelModify(x, y) + rdelta;
		}
		return 0;
	}

	var ret = 0;
	for(var yy = Math.max(y-1, 0); yy <= Math.min(y+1, this.ys-1); yy++){
		for(var xx = Math.max(x-1, 0); xx <= Math.min(x+1, this.xs-1); xx++){
			if(xx !== x || yy !== y)
				ret += levelModifyInt.call(this, x, y, xx, yy);
		}
	}
	for(var yy = Math.max(y-1, 0); yy <= Math.min(y, this.ys-1); yy++){
		for(var xx = Math.max(x-1, 0); xx <= Math.min(x, this.xs-1); xx++){
//			if(this.cellAt(xx, yy).flags & (FSWAMP | FBURNED))
//				TILEAT(pg->map, xx, yy).flags &= ~(FSWAMP | FBURNED | FHOUSE);
		}
	}
	var scope = this;
	this.forAdjacents(x, y, this.xs-2, this.ys-2, 3 * 2, function(x,y){
		scope.updateHouse(x,y); return true;});
	return ret;
}

PopGame.prototype.updateHouse = function(x, y){
	var cell = this.cellAt(x,y);
	if(cell.type === "house"){
		if(this.isFlat(x, y)){
			var farms = this.adjacentFarms(x, y);
			var team = cell.team;
			cell.farms = farms;

			var scope = this;
			/* if the area is flat enough, upgrade the house to castles */
			if(farms <= 8){
				this.forAdjacents(x, y, this.xs-2, this.ys-2, 3 * 2, function(x0,y0){
					return scope.setFarm(x0,y0,false,1,x,y)});
				this.forAdjacents(x, y, this.xs-2, this.ys-2, 6 * 2, function(x0,y0){
					return scope.updateHouseFarm(x0,y0)});
			}
			else if(farms <= 24){
				this.forAdjacents(x, y, this.xs-2, this.ys-2, 2 * 2, function(x0,y0){
					return scope.setFarm(x0,y0,true,1,x,y)});
			}
			else{
				this.forAdjacents(x, y, this.xs-2, this.ys-2, 3 * 2, function(x0,y0){
					return scope.setFarm(x0,y0,true,1,x,y)});
			}
		}
		else{
			this.moveOutHouse(x, y);
		}
	}
}

PopGame.prototype.updateHouseFarm = function(x0, y0){
	if(this.cellAt(x0, y0).type === "house"){
		var farms = this.adjacentFarms(x0, y0);
//		team = GET_TEAM(&TILEAT(mp, x0, y0));
		var team = 1;
		var scope = this;
		this.forAdjacents(x0, y0, this.xs-2, this.ys-2, 2 * (farms <= 8 ? 1 : farms <= 24 ? 2 : 3),
			function(x,y){ return scope.setFarm(x,y,true,team,x0,y0); });
	}
	return 1;
}

PopGame.prototype.moveOutHouse = function(x0, y0){
	var u = new PopGame.Unit(this, x0, y0);
	this.units.push(u);
	var c = this.cellAt(x0, y0);

	if(u){
		u.health = c.amount;
//		u.task = tauto;
//		u.team = c.team;
//		u.weapon = 0;
//		if(this.question == pt)
//			this.question = pu;
	}

	c.type = undefined;

	/* and the chain reaction continues */
	var scope = this;
	this.forAdjacents(x0, y0, this.xs-2, this.ys-2, 3 * 2, function(x,y){
		return scope.setFarm(x,y,false,1,x0,y0)});
	this.forAdjacents(x0, y0, this.xs-2, this.ys-2, 6 * 2, function(x,y){
		return scope.updateHouseFarm(x,y)});
}

PopGame.prototype.isFarmable = function(x,y){
	var type = this.cellAt(x,y).type;
	if(!type)
		return true;
	else if(type === "house")
		return false;
	return true;
}

PopGame.prototype.adjacentFarms = function(x, y){
	var ret = 0;
	var rad = 1, edge;
	for(var xx = Math.max(x-1, 0); xx <= Math.min(x+1, this.xs-2); xx++){
		for(var yy = Math.max(y-1, 0); yy <= Math.min(y+1, this.ys-2); yy++){
			if(xx != x || yy != y){
				if(this.isFlat(xx, yy) && this.isFarmable(xx, yy))
					ret++;
			}
		}
	}
	if(ret == 8){
		for(var xx = Math.max(x-2, 0); xx <= Math.min(x+2, this.xs-2); xx++){
			for(var yy = Math.max(y-2, 0); yy <= Math.min(y+2, this.ys-2); yy++){
				if(xx < x-1 || x+1 < xx || yy < y-1 || y+1 < yy){
					if(this.isFlat(xx, yy) && this.isFarmable(xx, yy))
						ret++;
				}
			}
		}
	}
	if(24 <= ret){
		for(var xx = Math.max(x-3, 0); xx <= Math.min(x+3, this.xs-2); xx++){
			for(var yy = Math.max(y-3, 0); yy <= Math.min(y+3, this.ys-2); yy++){
				if(xx < x-2 || x+2 < xx || yy < y-2 || y+2 < yy){
					if(this.isFlat(xx, yy) && this.isFarmable(xx, yy))
						ret++;
				}
			}
		}
	}
	return ret;
}

PopGame.prototype.forAdjacents = function(x0,y0,mx,my,rad,proc){
	for(var x = Math.max(x0-rad/2, 0); x <= Math.min(x0+(rad+1)/2, mx); x++){
		for(var y = Math.max(y0-rad/2, 0); y <= Math.min(y0+(rad+1)/2, my); y++){
			/*if(x != x0 || y != y0)*/{
				ret = proc(x, y);
				if(!ret)
					return 0;
			}
		}
	}
	return 1;
}

PopGame.prototype.setFarm = function(x,y,f,team,x0,y0){
	var cell = this.cellAt(x, y);

	// Delete farm
	if(!f){
		if(cell.type === "house" /*|| cell.type === "burned"*/)
			return true;
		cell.type = undefined;
		return true;
	}

	/* dont move yourself out */
	if(x == x0 && y == y0)
		return true;

	/* burned land cannot be yours. */
//	if(cell.flags & FBURNED)
//		return 1;

	/* if there's a house in a castle's farms, move it out.
	  note that another castle can never get moved out. */
	if(cell.type === "house"){
		this.moveOutHouse(x, y);
	}

	/* set farm bits */
	cell.type = "farm";
//	SET_TEAM(pt, team);
	return true;
}



/// Simple random number generator.
function RandomSequence(seed){
	this.z = (seed & 0xffffffff) + 0x7fffffff;
	this.w = (((this.z ^ 123459876) * 123459871) & 0xffffffff) + 0x7fffffff;
}

RandomSequence.prototype.nexti = function(){
	return ((((this.z=36969*(this.z&65535)+(this.z>>16))<<16)+(this.w=18000*(this.w&65535)+(this.w>>16))) & 0xffffffff) + 0x7fffffff;
}

RandomSequence.prototype.next = function(){
	return this.nexti() / 0xffffffff;
}

/// Noise with a low frequency which is realized by interpolating polygon chart.
function smoothNoise(i){
	var seed = 123;
	var period = 600; // one minute
	var sum = 0.;
	for(var j = 0; j <= 1; j++){
		var rng = new RandomSequence(Math.floor(i / period) + j);
		var value = rng.next(rng);
		// Uniformly distributed random variable is squared to make rainy weather have lower probability.
		sum += value * value * (j ? i % period : period - i % period) / period;
	}
	return sum;
}

PopGame.prototype.updateInternal = function(dt){
	for(var x = 0; x < this.xs; x++){
		for(var y = 0; y < this.ys; y++){
			var cell = this.cellAt(x, y);
			cell.update(this, x, y, dt);

			this.onUpdateCell(cell,x,y);
		}
	}

	for(var i = 0; i < this.units.length;){
		var u = this.units[i];
		if(!u.update(dt)){
			this.units.splice(i, 1);
			this.onDeleteUnit(u);
		}
		else{
			this.onUpdateUnit(u);
			i++;
		}
	}
}

