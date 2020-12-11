class GLBrushRenderer {
	constructor(renderer) {
		this.mainRenderer=renderer;
		this.gl=renderer.gl;
		this._initBlendBrushtipProgram();
		this._initSolidCircleProgram();
		this._initSamplingCircleProgram();
		this._initColorSamplingCircleProgram();

		// originalImageData: for buffering stroke data
		//this.originalImageData=renderer.createImageData(viewport.width,viewport.height);
		// storing the shape of brush tip
		//this.strokeImageData=renderer.createImageData(viewport.width,viewport.height);
		const MAX_SIZE=BrushManager.limits.maxSize*2;
		this.brushtipImageData=renderer.createImageData(MAX_SIZE,MAX_SIZE); // fixed size
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

	_initSolidCircleProgram() {
		// slice number of a circle divided. Does not quite related with rendering speed.
		// 64 should be enough for an approximate circle
		const circleSliceN=64;

		// add the glsl codes inside a closure
		const vCircleShaderSource=glsl` // vertex shader for drawing a circle
			// circle id (not used) is the order of the circle to be drawn
			// face id is the order of the triangle in the circle
			// vertex id is the order of the vertex in a triangle (0,1,2)
			// OpenGL guarantees the primitive rasterization order same as VBO
			#define DBPI 6.2831853071795864769 // 2*PI

			attribute float a_id; // vertex id: faceid*3+vertexid

			uniform vec2 u_res_tgt; // target canvas resolution
			uniform float u_circle_slice_N; // slice number of a circle divided

			uniform vec3 u_pos_tgt; // circle position (x,y,r) in pixels
			varying float v_rel; // linear opacity interpolation
			void main(){
				vec2 d_pos;
				if(mod(a_id,3.0)<0.5){ // 0' vertex
					d_pos=vec2(0.0,0.0);
					v_rel=1.0;
				}
				else{ // 1',2' vertex
					float id=floor((a_id+1.1)/3.0);
					float u=id/u_circle_slice_N; // 0~1
					float angle=u*DBPI;
					d_pos=vec2(cos(angle),sin(angle))*u_pos_tgt.z;
					v_rel=0.0;
				}
				vec2 pos=u_pos_tgt.xy+d_pos;
				vec2 v_clip=(pos/u_res_tgt*2.0-1.0)*vec2(1.0,-1.0);
				gl_Position=vec4(v_clip,0.0,1.0);
			}
		`;

		const fCircleShaderSource=glsl`
			precision mediump float;
			uniform float u_softness; // circle edge softness
			uniform vec4 u_color; // rgba
			varying float v_rel; // distance to circle center
			void main(){
				//float opa=smoothstep(0.0,u_softness,v_rel); // sharper than following
				if(v_rel>=u_softness){
					gl_FragColor=u_color;
				}
				else{ // sample on this function averages to 1/3
					float r=v_rel/u_softness;
					float opa=clamp(r*r,0.0,1.0); // prevent NaN operation
					gl_FragColor=u_color*opa;
				}
			}
		`;
		// ================= Create program ====================
		const program=new GLProgram(this.gl,vCircleShaderSource,fCircleShaderSource);
		this.solidCircleProgram=program;
		// ================ Create buffer ================

		// prepare vertices id array
		const vertexIdArray=new Float32Array(circleSliceN*3);
		vertexIdArray.forEach((v,i) => {vertexIdArray[i]=i;});
		program.setAttribute("a_id",vertexIdArray,1);
		program.setUniform("u_circle_slice_N",circleSliceN);
	}

	_initSamplingCircleProgram() {
		const circleSliceN=64;
		const vCircleShaderSource=glsl` // vertex shader for drawing a circle
			#define DBPI 6.2831853071795864769 // 2*PI

			attribute float a_id; // vertex id: faceid*3+vertexid
			uniform float u_circle_slice_N; // slice number of a circle divided

			uniform vec2 u_res_tgt; // target texture resolution
			uniform vec3 u_pos_tgt; // circle position (x,y,r) in pixels
			uniform vec2 u_res_tex; // sampler texture resolution
			uniform vec2 u_pos_tex; // sample position (x,y) in pixels
			uniform vec2 u_pos_dst; // circle position (x,y) in pixels of the stamping dest pos

			varying float v_rel; // linear opacity interpolation
			varying vec2 v_samp_tex; // samping coordinate (0~1) (prev pos)
			varying vec2 v_samp_dst; // drawing target coordinate (0~1) (new pos)
			void main(){
				vec2 d_pos;
				if(a_id<5.5){ // first two bg triangles
					float R=u_pos_tgt.z+4.; // add more margin to cover
					float dX,dY;
					if(mod(a_id,2.)>0.5)dY=R; else dY=-R;
					if(a_id>1.5&&a_id<4.5)dX=R; else dX=-R;
					d_pos=vec2(dX,dY);
					v_rel=-1.;
				} // Following codes: a_id should -6 instead
				else if(mod(a_id,3.)<0.5){ // 0' vertex
					d_pos=vec2(0.,0.);
					v_rel=1.;
				}
				else{ // 1',2' vertex
					float id=floor((a_id-4.9)/3.); // should be -5., error containing
					float u=id/u_circle_slice_N; // 0~1
					float angle=u*DBPI;
					d_pos=vec2(cos(angle),sin(angle))*u_pos_tgt.z;
					v_rel=0.;
				}
				vec2 pos_tgt=u_pos_tgt.xy+d_pos; // in pixels, LU
				vec2 pos_tex=u_pos_tex+d_pos;
				vec2 pos_dst=u_pos_dst+d_pos;
				/** NOTE: add floor to these values creates very artistic effects */

				vec2 coord_samp=pos_tex/u_res_tex; // sampling pos in sampler coordinate
				vec2 coord_dst=pos_dst/u_res_tex;

				v_samp_tex=vec2(coord_samp.x,1.-coord_samp.y);
				v_samp_dst=vec2(coord_dst.x,1.-coord_dst.y);

				vec2 v_clip=(pos_tgt/u_res_tgt*2.-1.)*vec2(1.,-1.); // vertex pos in clip space
				gl_Position=vec4(v_clip,0.,1.);
			}
		`;

		const fCircleShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image; // sampling source texture
			uniform float u_softness; // circle edge softness
			uniform vec4 u_color; // rgba
			uniform float u_opa_tex; // sampling texture opacity

			varying float v_rel;
			varying highp vec2 v_samp_tex;
			varying highp vec2 v_samp_dst;

			// float random (vec2 st) {
			// 	return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123);
			// }

			void main(){
				vec4 dst_color=texture2D(u_image,v_samp_dst);
				if(v_rel<0.){ // bg triangle
					gl_FragColor=dst_color;
				}
				else {
					float opa;
					if(v_rel>=u_softness){ // get current color
						opa=u_opa_tex;
					}
					else{
						float r=v_rel/u_softness;
						opa=clamp(r*r,0.,1.)*u_opa_tex; // prevent NaN operation
					}

					vec4 samp_color=texture2D(u_image,v_samp_tex); // sample from texture
					samp_color=u_color*samp_color.w+samp_color*(1.-u_color.w); // add tint, opa unchanged
					gl_FragColor=dst_color+(samp_color-dst_color)*opa; // average blending
				}
			}
		`;
		// ================= Create program ====================
		const program=new GLProgram(this.gl,vCircleShaderSource,fCircleShaderSource);
		this.samplingCircleProgram=program;
		// ================ Create buffer ================

		// prepare vertices id array
		const vertexIdArray=new Float32Array(circleSliceN*3+6);
		vertexIdArray.forEach((v,i) => {vertexIdArray[i]=i;});
		program.setAttribute("a_id",vertexIdArray,1);
		program.setUniform("u_circle_slice_N",circleSliceN);
	}

	_initColorSamplingCircleProgram() {
		const circleSliceN=64;
		const vCircleShaderSource=glsl` // vertex shader for drawing a circle
			#define DBPI 6.2831853071795864769 // 2*PI

			attribute float a_id; // vertex id: faceid*3+vertexid
			uniform float u_circle_slice_N; // slice number of a circle divided

			uniform vec2 u_res_tgt; // target texture resolution
			uniform vec3 u_pos_tgt; // circle position (x,y,r) in pixels

			varying float v_rel; // linear opacity interpolation
			void main(){
				vec2 d_pos;
				if(mod(a_id,3.)<0.5){ // 0' vertex
					d_pos=vec2(0.,0.);
					v_rel=1.;
				}
				else{ // 1',2' vertex
					float id=floor((a_id+1.1)/3.);
					float u=id/u_circle_slice_N; // 0~1
					float angle=u*DBPI;
					d_pos=vec2(cos(angle),sin(angle))*u_pos_tgt.z;
					v_rel=0.;
				}
				vec2 pos_tgt=u_pos_tgt.xy+d_pos; // in pixels, LU

				vec2 v_clip=(pos_tgt/u_res_tgt*2.-1.)*vec2(1.,-1.); // vertex pos in clip space

				gl_Position=vec4(v_clip,0.,1.);
			}
		`;

		const fCircleShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image; // sampling source texture
			uniform float u_softness; // circle edge softness
			uniform vec4 u_color; // rgba, UNMULTIPLIED!
			uniform float u_opa_tex; // sampling texture opacity

			uniform highp vec2 u_pos_tex; // sample position (x,y) in pixels
			uniform highp vec2 u_res_tex; // sampler texture resolution

			varying float v_rel;
			void main(){
				float opa;
				if(v_rel>=u_softness){ // get current color
					opa=1.;
				}
				else{
					float r=v_rel/u_softness;
					opa=clamp(r*r,0.,1.); // prevent NaN operation
				}

				vec2 coord_samp=u_pos_tex/u_res_tex; // sampling pos in sampler coordinate
				vec2 v_samp_tex=vec2(coord_samp.x,1.-coord_samp.y);

				vec4 cs=texture2D(u_image,v_samp_tex); // sample from texture
				vec4 cc=vec4(u_color.xyz,1.); // solid color
				vec4 cr=cc+(cs-cc)*u_opa_tex; // mix solid color, prevent dirty color
				gl_FragColor=cr*u_color.w*opa; // add opacity at last
			}
		`;
		// ================= Create program ====================
		const program=new GLProgram(this.gl,vCircleShaderSource,fCircleShaderSource);
		this.colorSamplingCircleProgram=program;
		// ================ Create buffer ================

		// prepare vertices id array
		const vertexIdArray=new Float32Array(circleSliceN*3);
		vertexIdArray.forEach((v,i) => {vertexIdArray[i]=i;});
		program.setAttribute("a_id",vertexIdArray,1);
		program.setUniform("u_circle_slice_N",circleSliceN);
	}

	free() {
		this.blendBrushtipProgram.free();
		this.solidCircleProgram.free();
		this.samplingCircleProgram.free();
		this.colorSamplingCircleProgram.free();
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
	render(target,brush,pos,prevPos,radius,colorRGB,plateOpa,pressure,isOpacityLocked,softRange) {
		if(brush.brushtip){ // customized brushtip
			// blabla...
		}
		else if(brush.blendMode==2){ // smudge
			this.renderSamplingCircle(target,brush,pos,prevPos,radius,colorRGB,plateOpa,pressure,isOpacityLocked,softRange);
		}
		else if(brush.blendMode==1){ // paint
			this.renderColorSamplingCircle(target,brush,pos,prevPos,radius,colorRGB,plateOpa,pressure,isOpacityLocked,softRange);
		}
		else if(brush.blendMode<=0){ // erase, normal
			this.renderSolidCircle(target,brush,pos,prevPos,radius,colorRGB,plateOpa,pressure,isOpacityLocked,softRange);
		}

		target.validArea={ // round values
			left: Math.floor(target.validArea.left),
			top: Math.floor(target.validArea.top),
			width: Math.ceil(target.validArea.width),
			height: Math.ceil(target.validArea.height)
		};
	}
	renderSolidCircle(target,brush,pos,prevPos,radius,colorRGB,opacity,pressure,isOpacityLocked,softRange){
		// Step 1: render colored brushtip to this.brushtipImageData
		// Step 2: transfer brushtip to target
		// ... Well, should be like this
		// Using only one shader program allows re-using set program: efficient
		
		let color; // only RGB
		if(brush.blendMode>=0) { // pre-multiply colors
			color=[colorRGB[0]*opacity,colorRGB[1]*opacity,colorRGB[2]*opacity,opacity];
		}
		else { // white
			color=[opacity,opacity,opacity,opacity];
		}
		this.renderSolidCircleBrushtip(target,pos,radius,color,softRange,brush.blendMode,isOpacityLocked);

		// Update valid area
		// In other brushes, valid area update is made by blendTexture()
		if(!isOpacityLocked&&brush.blendMode>=0){ // valid area changed
			const R=radius+1; // extend 1 pixel for border
			const circleArea={
				width: R*2,
				height: R*2,
				left: pos[0]-R,
				top: pos[1]-R
			}
			target.validArea=GLProgram.borderIntersection(
				GLProgram.extendBorderSize(circleArea,target.validArea),
				target // clamp by border
			);
		}
	}

	// pos relative to viewport
	renderSolidCircleBrushtip(imgData,pos,r,color,softRange,mode,isOpacityLocked) {
		const gl=this.gl;
		const program=this.solidCircleProgram;

		program.setTargetTexture(imgData.data); // render to brushtip
		//program.setUniform("u_res_tgt",[imgData.width,imgData.height]);
		//gl.viewport(0,0,imgData.width,imgData.height);
		const L=Math.round(pos[0]-imgData.left-r-1);
		const B=Math.round(imgData.top+imgData.height-pos[1]-r-1);
		const D=Math.ceil(r*2+2);
		program.setUniform("u_res_tgt",[D,D]); // minimum viewport required
		gl.viewport(L,B,D,D);
		// 1 step: do not clear texture
		if(mode>=0){ // add
			if(isOpacityLocked){ // source atop
				gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
			}
			else{ // source over
				gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
			}
		}
		else{ // subtract
			if(isOpacityLocked){ // pure draw
				gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
			}
			else{ // dest out
				gl.blendFunc(gl.ZERO,gl.ONE_MINUS_SRC_ALPHA);
			}
		}

		//program.setUniform("u_pos_tgt",[pos[0],pos[1],r]);
		program.setUniform("u_pos_tgt",[ // precise position in viewport
			pos[0]-imgData.left-L,
			pos[1]-imgData.top-(imgData.height-B-D),
			r
		]);
		program.setUniform("u_color",color); // set circle color, alpha pre-multiply
		program.setUniform("u_softness",softRange);
		program.run();
	}

	// ================= Stamp/Smudge ==================
	renderSamplingCircle(target,brush,pos,prevPos,radius,colorRGB,opacity,pressure,isOpacityLocked,softRange){
		const bImg=this.brushtipImageData;
		let color=[colorRGB[0]*opacity,colorRGB[1]*opacity,colorRGB[2]*opacity,opacity];

		// set position, must be pixel aligned or the edge gets blurry
		let bL=pos[0]-radius-2;
		bImg.left=Math.floor(bL-target.left)+target.left;
		let bT=pos[1]-radius-2;
		bImg.top=Math.floor(bT-target.top)+target.top;
		bImg.validArea={
			width: radius*2+2,
			height: radius*2+2,
			left: bImg.left+1,
			top: bImg.top+1
		};
		if(!this.mainRenderer.antiAlias){ // round to aligned pixels
			prevPos=[Math.round(prevPos[0]-pos[0])+pos[0],Math.round(prevPos[1]-pos[1])+pos[1]];
		}
		const extension=isNaN(brush.extension)?1:brush.extension;
		this.renderSamplingCircleBrushtip(
			bImg,radius,color,softRange,
			target,pos,prevPos,
			extension*(brush.isAlphaPressure?pressure+(1-pressure)*brush.minAlpha:1)
		);
		this.mainRenderer.blendImageData(bImg,target,{
			mode: isOpacityLocked?GLTextureBlender.NORMAL:GLTextureBlender.SOURCE, // NORMAL avoid alpha loss
			alphaLock: isOpacityLocked,
			antiAlias: false, // pixel-aligned
		});
	}

	renderSamplingCircleBrushtip(imgData,r,color,softRange,sampImgData,tgtPos,sampPos,sampOpacity) {
		const gl=this.gl;
		const program=this.samplingCircleProgram;

		program.setTargetTexture(imgData.data); // render to brushtip
		gl.viewport(0,0,imgData.width,imgData.height); // @TODO: may shrink a little bit?
		gl.clearColor(0,0,0,0); // clear brushtip
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.blendFunc(gl.ONE,gl.ZERO); // pure source draw

		// Add 1 pix to brush imagedata edge to enable gl.LINEAR filtering at edges
		// afterall the target is 2px wider in canvas
		program.setUniform("u_res_tgt",[imgData.width,imgData.height]);
		program.setUniform("u_pos_tgt",[tgtPos[0]-imgData.left,tgtPos[1]-imgData.top,r]); // draw on left-top
		program.setUniform("u_color",color); // set circle color, alpha pre-multiply
		program.setUniform("u_softness",softRange);

		program.setSourceTexture("u_image",sampImgData.data); // sample from sampImgData
		program.setUniform("u_res_tex",[sampImgData.width,sampImgData.height]);
		program.setUniform("u_pos_tex",[sampPos[0]-sampImgData.left,sampPos[1]-sampImgData.top]);
		program.setUniform("u_pos_dst",[tgtPos[0]-sampImgData.left,tgtPos[1]-sampImgData.top]);
		program.setUniform("u_opa_tex",sampOpacity); // sampling opacity factor
		program.run();
	}

	// ===================== Color sampling =======================
	renderColorSamplingCircle(target,brush,pos,prevPos,radius,colorRGB,opacity,pressure,isOpacityLocked,softRange){
		// Step 1: render colored brushtip to this.brushtipImageData
		const bImg=this.brushtipImageData;
		// set position
		bImg.left=pos[0]-radius-1;
		bImg.top=pos[1]-radius-1;
		bImg.validArea={
			width: radius*2+2,
			height: radius*2+2,
			left: bImg.left,
			top: bImg.top
		};
		
		const extension=isNaN(brush.extension)?1:brush.extension;
		const v=this.mainRenderer.quality/6;
		const eps=Math.min(-Math.log(1-extension)/v,1); // 0~inf, trunc at near 1
		const k=1-opacity;
		const b=1-(1-eps)*k;
		const a=b?k*eps/b:1; // in case b=0
		
		const color=[colorRGB[0],colorRGB[1],colorRGB[2],b.clamp(0,1)]; // pass in unmultiplied directly
		this.renderColorSamplingCircleBrushtip(
			bImg,radius,color,softRange,
			target,pos,pos,a.clamp(0,1)
		);

		// Step 2: transfer brushtip to target
		this.mainRenderer.blendImageData(bImg,target,{
			mode: GLTextureBlender.NORMAL,
			alphaLock: isOpacityLocked,
			antiAlias: this.mainRenderer.antiAlias,
			srcAlpha: 1
		});
	}
	renderColorSamplingCircleBrushtip(imgData,r,color,softRange,sampImgData,tgtPos,sampPos,sampOpacity) {
		const gl=this.gl;
		const program=this.colorSamplingCircleProgram;

		program.setTargetTexture(imgData.data); // render to brushtip
		gl.viewport(0,0,imgData.width,imgData.height);
		gl.clearColor(0,0,0,0); // clear brushtip
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.blendFunc(gl.ONE,gl.ZERO); // pure source draw

		// Add 1 pix to brush imagedata edge to enable gl.LINEAR filtering at edges
		// afterall the target is 2px wider in canvas
		program.setUniform("u_res_tgt",[imgData.width,imgData.height]);
		program.setUniform("u_pos_tgt",[r+1,r+1,r]); // draw on left-top
		program.setUniform("u_color",color); // set circle color, alpha pre-multiply
		program.setUniform("u_softness",softRange);

		program.setSourceTexture("u_image",sampImgData.data); // sample from sampImgData
		program.setUniform("u_res_tex",[sampImgData.width,sampImgData.height]);
		program.setUniform("u_pos_tex",[sampPos[0]-sampImgData.left,sampPos[1]-sampImgData.top]);
		program.setUniform("u_opa_tex",sampOpacity); // sampling opacity factor
		program.run();
	}
}