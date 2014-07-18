
function PopGame(xs,ys){
	this.xs = xs;
	this.ys = ys;
	this.rng = new Xor128();

	this.cells = Array(xs * ys);

	this.workingPower = 100;
	this.cash = 100;
	this.weather = 0;
	this.time = 0;
	this.frameCount = 0;
	this.autosave_frame = 0;
}

PopGame.Cell = function(height){
	this.height = height;
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
	return this.cells[x * this.ys + y];
}

PopGame.prototype.isFlat = function(x,y){
	var c = this.cellAt(x, y);
	var cl = this.cellAt(x-1, y);
//	var cr = this.cellAt(x+1, y);
	var cu = this.cellAt(x, y-1);
//	var cd = this.cellAt(x, y+1);
	return cl && cl.height === c.height /*&& cr && cr.height === c.height*/
		&& cu && cu.height === c.height /*&& cd && cd.height === c.height*/;
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

PopGame.prototype.update = function(deltaTime){
	var frameTime = 100; // Frame time interval in milliseconds
	this.time += deltaTime;

	// Repeat the frame procedure in constant interval.
	while(frameTime < this.time){

		this.updateInternal();

		this.time -= frameTime;
	}
}

PopGame.prototype.levelModify = function(x,y){
	function clamp(s, ma, mi){
		return s < mi ? mi : ma < s ? ma : s;
	}
	function levelModifyInt(x0, y0, x, y){
		var c = this.cellAt(x, y);
		var h0 = this.cellAt(x0, y0).height;
		var delta = c.height - h0;
	/*	printf("(%d,%d)%d - (%d,%d)%d = %d\n", x, y, *ph, x0, y0, h0, delta);*/
		var cdelta = clamp(delta, 1, -1);
		if(cdelta !== delta){
			c.height = h0 + cdelta;
			this.levelInvokes++;
/*			if(pp){
				pp->mana -= LEVEL_COST;
				if(0 <= pp->clays + delta && pp->clays + delta < pp->maxclays) pp->clays += delta;
			}*/
			return this.levelModify(x, y);
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
//	ForAdjacents(x, y, pg->map->xs-2, pg->map->ys-2, 3 * 2, VUpdateHouse, pg);
	return ret;
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

PopGame.prototype.updateInternal = function(){
	var creeksx = 0, creeksy = 0;
	this.levelInvokes = 0;
	for(var x = 0; x < this.xs; x++){
		for(var y = 0; y < this.ys; y++){
			var cell = this.cellAt(x, y);
			
			if(2 < x && x % 2 == 0 && 2 < y && y % 2 == 0 && 10 < x){
				cell.height = this.rng.nexti() % 2;
//				this.cellAt(x-1, y).height = cell.height;
//				this.cellAt(x-1, y-1).height = cell.height;
				this.cellAt(x, y-1).height = cell.height;
				this.levelModify(x, y);
			}
			
			if(x + 1 < this.xs && 1 < Math.abs(cell.height - this.cellAt(x + 1, y)))
				creeksx++;
			if(y + 1 < this.ys && 1 < Math.abs(cell.height - this.cellAt(x, y + 1)))
				creeksy++;

			game.onUpdateCell(cell,x,y);
		}
	}
	
	console.log("creeks: " + creeksx + ", " + creeksy + ", " + this.levelInvokes);

}

