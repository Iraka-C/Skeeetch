"use strict";
class GLBrushRenderer {
	constructor(renderer) {
		this.mainRenderer=renderer;
		this.gl=renderer.gl;
		const MAX_SIZE=BrushManager.limits.maxSize*2;
		this.brushtipImageData=renderer.createImageData(MAX_SIZE,MAX_SIZE); // fixed size

		// Init Programs

		this._initBlendBrushtipProgram();
		this.solidCircleRenderer=new GLRoundPencilBlockRenderer(this); // use block renderer
		this.samplingCircleRenderer=new GLRoundSmudgeRenderer(this);
		this.colorSamplingCircleRenderer=new GLRoundPaintbrushRenderer(this);

		// originalImageData: for buffering stroke data
		//this.originalImageData=renderer.createImageData(viewport.width,viewport.height);
		// storing the shape of brush tip
		//this.strokeImageData=renderer.createImageData(viewport.width,viewport.height);
	}

	_initBlendBrushtipProgram() {
		const vBlendShaderSource=glsl` // vertex shader for drawing a circle
			attribute vec2 a_position; // vertex position
			varying vec2 v_position;
			void main(){
				v_position=a_position;
				gl_Position=vec4(a_position*2.0-1.0,0.0,1.0); // to clip space
			}
		`;
		const fBlendShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image;
			uniform vec2 u_aa_step; // anti-alias pixel interval (x,y) in sampler coordinate, may be non-int
			uniform float u_aa_cnt; // how many steps to sample
			varying highp vec2 v_position;

			const float max_its=10.;
			void main(){
				float cnt=u_aa_cnt+1.;
				vec4 totalColor=texture2D(u_image,v_position)*cnt;
				float totalCnt=cnt;
				for(float i=1.;i<max_its;i++){
					if(i>=cnt)break; // counting finished
					vec2 dPos=u_aa_step*i;
					float k=cnt-i;
					totalColor+=texture2D(u_image,v_position+dPos)*k;
					totalColor+=texture2D(u_image,v_position-dPos)*k;
					totalCnt+=k+k;
				}
				gl_FragColor=totalColor/totalCnt; // average pixel
			}
		`;
		// ================= Create program ====================
		this.blendBrushtipProgram=new GLProgram(this.gl,vBlendShaderSource,fBlendShaderSource);
		//this.blendBrushtipProgram.setAttribute("a_position",[0,0,1,0,0,1,0,1,1,0,1,1],2);
	}

	

	free() {
		this.blendBrushtipProgram.free();
		this.solidCircleRenderer.free();
		this.samplingCircleRenderer.free();
		//this.colorSamplingCircleProgram.free();
		this.colorSamplingCircleRenderer.free();
		this.mainRenderer.deleteImageData(this.brushtipImageData);
	}

	washBrush(){

	}

	/**
	 * Allow using directional blurring to mitigate hard edges
	 * Used for brush.blendMode==<-1|0|1|>
	 */
	blendBrushtip(src,tgt,param){
		program.setTargetTexture(tgt.data); // draw to temp data
		gl.viewport(0,0,w,h);
		gl.clearColor(0,0,0,0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		program.setSourceTexture("u_image",src.data);
		program.setUniform("u_aa_step",[1/w,0]);
		program.setUniform("u_aa_cnt",antiAliasRadius);
		gl.viewport(imgData.left,h-ih-imgData.top,iw,ih); // set viewport according to the image data
		gl.blendFunc(this.gl.ONE,this.gl.ZERO); // copy
		program.run();
	}

	// ========================== Render Brushtip Shape ==============================

	/**
	 * 
	 * @param {*} target 
	 * @param {*} brush 
	 * @param {[Number,Number]} pos [x,y] under paper coordinate
	 * @param {[Number,Number]} prevPos [x,y], the previous position for sampling under paper coordinate
	 * @param {Number} radius diameter of the brush
	 * @param {[R,G,B,A]} colorRGB Non-Premultiplied [r,g,b] in 0~1
	 * @param {Number} opacity total brush opacity (already pressure considered)
	 * @param {Boolean} isOpacityLocked 
	 * @param {Number} softRange 
	 */
	/*render(target,brush,pos,prevPos,radius,colorRGB,plateOpa,pressure,isOpacityLocked,softRange) {
		// move render single circles to each brush renderer
	}*/

	/**
	 * 
	 * @param {GLTexture} target 
	 * @param {Brush Object} brush 
	 * @param {*} pointsInfo [{
			pos,prevPos,vel,prevVel: [x,y],
			size: (Number)radius,
			color: rgb, premultiplied,
			pointOpacity: (Number)plateOpa,
			pressure: pressure considered sensitivity,
			softRange: softness,
			aaRange: anti-aliasing extra soft range
	 * }, ...]
	 * @param {Boolean} isOpacityLocked 
	 */
	renderPoints(target,brush,pointsInfo,isOpacityLocked){

		if(brush.brushtip){ // customized brushtip
			// blabla...
		}
		else if(brush.blendMode==2){ // smudge
			this.samplingCircleRenderer.renderPoints(target,brush,pointsInfo,isOpacityLocked);
		}
		else if(brush.blendMode==1){ // paint
			this.colorSamplingCircleRenderer.renderPoints(target,brush,pointsInfo,isOpacityLocked);
		}
		else if(brush.blendMode<=0){ // erase, normal
			this.solidCircleRenderer.renderPoints(target,brush,pointsInfo,isOpacityLocked);
		}

		target.validArea={ // round values
			left: Math.floor(target.validArea.left),
			top: Math.floor(target.validArea.top),
			width: Math.ceil(target.validArea.width),
			height: Math.ceil(target.validArea.height)
		};
	}
	
	
}