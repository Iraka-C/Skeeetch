class GLGeneralBrushRenderer{
	constructor(brushRenderer){
		this.brushRenderer=brushRenderer;
		this.mainRenderer=brushRenderer.mainRenderer; // general texture renderer
		this.gl=brushRenderer.gl;
		this.brushtipImageData=brushRenderer.brushtipImageData;

		this.initProgram();
	}

	initProgram(){
		// init a GLProgram
		// should be defined as this.program
	}

	free(){
		// free the GLProgram
		if(this.program){
			this.program.free();
		}
	}

	render(target,brush,pos,prevPos,radius,colorRGB,opacity,pressure,isOpacityLocked,softRange){
		// parameters generally like this
	}

	renderPoints(target,brush,pointsInfo,isOpacityLocked){
		// render a series of points
		// by default: using for to loop through each, with AA
		for(const p of pointsInfo){
			this.render(
				target,brush,
				p.pos,p.prevPos,p.size,
				p.color,p.pointOpacity,p.pressure,
				isOpacityLocked,
				p.softRange+p.aaRange
			);
		}
	}
}