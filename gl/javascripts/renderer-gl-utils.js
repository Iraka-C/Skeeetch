/**
 * Class to blend two textures
 * Works in a same color space with linear blending
 */
class GLTextureBlender {
	// Enums at the end of class definition

	constructor(renderer) {
		this.renderer=renderer;
		const gl=renderer.gl;
		const vBlendShaderSource=glsl`
			attribute vec2 a_dst_pos; // drawing area on target
			attribute vec2 a_src_pos; // sample area from source
			varying vec2 v_pos;
			void main(){
				v_pos=a_src_pos;
				gl_Position=vec4(a_dst_pos*2.-1.,0.,1.); // to clip space
			}
		`;
		const fBlendShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image;
			uniform float u_image_alpha;
			varying vec2 v_pos;
			void main(){
				if(v_pos.x<0.||v_pos.y<0.||v_pos.x>1.||v_pos.y>1.){ // out of bound, sharp cut
					gl_FragColor=vec4(0.,0.,0.,0.); // transparent
				}
				else{ // sample from u_image
					gl_FragColor=texture2D(u_image,v_pos)*u_image_alpha;
				}
			}
		`;
		const vAdvancedBlendShaderSource=glsl`
			attribute vec2 a_pos_0; // src area
			attribute vec2 a_pos_1; // dst area
			attribute vec2 a_pos_tgt; // render to area (new src)
			varying vec2 v_pos_0;
			varying vec2 v_pos_1;
			void main(){
				v_pos_0=a_pos_0;
				v_pos_1=a_pos_1;
				gl_Position=vec4(a_pos_tgt*2.-1.,0.,1.); // to clip space
			}
		`;
		const fAdvancedBlendShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image_0; // src (on top) : provides Cs
			uniform sampler2D u_image_1; // dst (backdrop) : provides Cb
			uniform float u_image_alpha; // src alpha
			uniform float u_blend_mode; // according to enums
			varying vec2 v_pos_0; // vertex from src
			varying vec2 v_pos_1; // vertex from dst

			vec3 multiply(vec3 Cb,vec3 Cs){return Cb*Cs;} // #2
			vec3 screen(vec3 Cb,vec3 Cs){return Cb+Cs-Cb*Cs;} // #3
			vec3 darken(vec3 Cb,vec3 Cs){return min(Cb,Cs);} // #7
			vec3 lighten(vec3 Cb,vec3 Cs){return max(Cb,Cs);} // #8 May overflow than alpha!
			vec3 color_dodge(vec3 Cb,vec3 Cs){return clamp(Cb/(vec3(1.,1.,1.)-Cs),0.,1.);} // #11 clamped
			vec3 color_burn(vec3 Cb,vec3 Cs){return vec3(1.,1.,1.)-clamp((vec3(1.,1.,1.)-Cb)/Cs,0.,1.);} // #12 clamped
			vec3 hard_light(vec3 Cb,vec3 Cs){
				vec3 stepCs=step(0.5,Cs); // Cs>0.5: 1, Cs<0.5: 0
				vec3 signCs=2.*stepCs-1.; // Cs>0.5: 1, Cs<0.5: -1
				vec3 p1=2.*(Cb+Cs)-vec3(1.,1.,1.);
				vec3 p2=2.*Cb*Cs;
				return p1*stepCs-p2*signCs;
			} // #4, #5
			float soft_light_channel(float Pb,float Ps){
				float Rs=2.*Ps-1.;
				if(Ps<0.5)return Pb+Rs*Pb*(1.-Pb);
				if(Pb<0.25)return Pb+Rs*Pb*((16.*Pb-12.)*Pb+3.);
				return Pb+Rs*(sqrt(Pb)-Pb);
			}
			vec3 soft_light(vec3 Cb,vec3 Cs){
				return vec3(
					soft_light_channel(Cb.x,Cs.x),
					soft_light_channel(Cb.y,Cs.y),
					soft_light_channel(Cb.z,Cs.z)
				);
			} // #6
			vec3 difference(vec3 Cb,vec3 Cs){return abs(Cb-Cs);} // #9
			vec3 exclusion(vec3 Cb,vec3 Cs){return Cb+Cs-2.*Cb*Cs;} // #10

			void main(){
				vec4 pix0=vec4(0.,0.,0.,0.); // src pixel
				vec4 pix1=vec4(0.,0.,0.,0.); // dst pixel
				if(v_pos_0.x>=0.&&v_pos_0.x<=1.&&v_pos_0.y>=0.&&v_pos_0.y<=1.){
					pix0=texture2D(u_image_0,v_pos_0)*u_image_alpha;
				}
				if(v_pos_1.x>=0.&&v_pos_1.x<=1.&&v_pos_1.y>=0.&&v_pos_1.y<=1.){
					pix1=texture2D(u_image_1,v_pos_1);
				}
				if(pix1.w==0.){ // dst alpha is 0, maintain src pixel
					gl_FragColor=pix0;
					return;
				}
				if(pix0.w==0.){ // src alpha is 0, no effect
					gl_FragColor=vec4(0.,0.,0.,0.);
					return;
				}

				// premult => non premult
				vec3 Cs=pix0.xyz/pix0.w;
				vec3 Cb=pix1.xyz/pix1.w;

				vec3 Cm=vec3(0.,0.,0.); // blended result
				if(u_blend_mode<2.5){Cm=multiply(Cb,Cs);}
				else if(u_blend_mode<3.5){Cm=screen(Cb,Cs);}
				else if(u_blend_mode<4.5){Cm=hard_light(Cs,Cb);} // overlay is inversed hard light
				else if(u_blend_mode<5.5){Cm=hard_light(Cb,Cs);}
				else if(u_blend_mode<6.5){Cm=soft_light(Cb,Cs);}
				else if(u_blend_mode<7.5){Cm=darken(Cb,Cs);}
				else if(u_blend_mode<8.5){Cm=lighten(Cb,Cs);}
				else if(u_blend_mode<9.5){Cm=difference(Cb,Cs);}
				else if(u_blend_mode<10.5){Cm=exclusion(Cb,Cs);}
				else if(u_blend_mode<11.5){Cm=color_dodge(Cb,Cs);}
				else if(u_blend_mode<12.5){Cm=color_burn(Cb,Cs);}

				vec3 Cr=Cs+pix1.w*(Cm-Cs); // interpolation by backdrop alpha
				gl_FragColor=vec4(Cr*pix0.w,pix0.w); // return modified Cs
			}
		`;

		this.gl=gl;
		this.blendProgram=new GLProgram(gl,vBlendShaderSource,fBlendShaderSource);
		this.advancedBlendProgram=new GLProgram(gl,vAdvancedBlendShaderSource,fAdvancedBlendShaderSource);
	}

	free() {
		this.blendProgram.free();
		this.advancedBlendProgram.free();
	}
	/**
	 * blend the src and dst textures in corresponding ranges
	 * src, dst: imagedatas of this.gl
	 * param={
	 *    mode: // see css mix-blend-mode standard
	 *       GLTextureBlender.SOURCE: use src to replace dst
	 *       GLTextureBlender.NORMAL: 1*src+(1-src)*dst normal blend
	 *       GLTextureBlender.EXCLUSION: color exclusion
	 *       GLTextureBlender.SCREEN: lighten
	 *    alphaLock: true | false // to change the dst alpha
	 *    srcAlpha: additional opacity of source, 0~1
	 *    targetArea: the area to blend, {w,h,l,t} under paper coordinate. The smaller, the faster.
	 * }
	 * 
	 * **NOTE** if src range exceeds dst size range, overflown parts will be discarded! (but irrelevant to viewport)
	 * **NOTE** if not param.alphaLock, then the dst.validArea may change!
	 */
	blendTexture(src,dst,param) {
		if(!param.targetArea)param.targetArea=src.validArea; // blend all src valid pixels
		param.targetArea=GLProgram.borderIntersection(param.targetArea,dst);
		if(!param.targetArea.width||!param.targetArea.height) { // target contains zero pixel
			return; // needless to blend
		}

		const gl=this.gl;
		param.alphaLock=param.alphaLock||false;
		if(param.mode===undefined) param.mode=GLTextureBlender.NORMAL;
		if(param.srcAlpha===undefined) param.srcAlpha=1;
		if(param.antiAlias===undefined) param.antiAlias=true;

		let advancedBlendFlag=false;
		switch(param.mode) {
			case GLTextureBlender.SOURCE:
				if(param.alphaLock) { // do not change target alpha
					gl.blendFunc(gl.DST_ALPHA,gl.ZERO);
				}
				else {
					gl.blendFunc(gl.ONE,gl.ZERO); // copy
				}
				break;
			case GLTextureBlender.ERASE:
				if(param.alphaLock) { // do not change target alpha
					// Nothing to erase
					gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA); // a_dest doesn't change
					// Same as NORMAL-alphaLock
					// This only works for brush-eraser
				}
				else { // valid area won't change
					gl.blendFunc(gl.ZERO,gl.ONE_MINUS_SRC_ALPHA); // no color
				}
				break;
			case GLTextureBlender.NONE: // Mainly for debugging
				if(param.alphaLock) { // do not change target alpha
					gl.blendFunc(gl.ZERO,gl.ONE); // do not change
				}
				else {
					gl.blendFunc(gl.ZERO,gl.ZERO); // no color, you'd rather use clearImageData()
				}
				break;
			case GLTextureBlender.NORMAL:
				if(param.alphaLock) { // do not change target alpha
					gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA); // source-atop composition
				}
				else {
					gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); // normal alpha blend
				}
				break;
			case GLTextureBlender.SCREEN:
				if(param.alphaLock) {
					advancedBlendFlag=true;
				}
				else {
					gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_COLOR); // screen color/alpha blend
				}
				break;
			case GLTextureBlender.EXCLUSION:
				if(param.alphaLock) {
					advancedBlendFlag=true;
				}
				else {
					gl.blendFuncSeparate( // exclusion color/alpha blend
						gl.ONE_MINUS_DST_COLOR,gl.ONE_MINUS_SRC_COLOR,
						gl.ONE,gl.ONE_MINUS_SRC_ALPHA
					);
				}
				break;
			case GLTextureBlender.AVERAGE:
				if(param.alphaLock) { // same as normal
					gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
				}
				else {
					gl.blendColor(param.srcAlpha,param.srcAlpha,param.srcAlpha,param.srcAlpha);
					gl.blendFunc(gl.ONE,gl.ONE_MINUS_CONSTANT_ALPHA);
				}
				break;
			default:
				advancedBlendFlag=true;
		}

		const tA=param.targetArea; // Do not change the contents!
		if(advancedBlendFlag) { // need advanced composition shader
			this.advancedBlendTexture(src,dst,param);
		}
		else{ // blend with blendFunc
			const program=this.blendProgram;
			program.setTargetTexture(dst.data);
			program.setSourceTexture("u_image",src.data);
			program.setUniform("u_image_alpha",param.srcAlpha);
	
			// set target area attribute, to 0~1 coord space(LB origin).
			// gl will automatically trim within viewport
			program.setAttribute("a_src_pos",GLProgram.getAttributeRect(tA,src,!param.antiAlias),2);
			program.setAttribute("a_dst_pos",GLProgram.getAttributeRect(tA,dst,!param.antiAlias),2);
	
			gl.viewport(0,0,dst.width,dst.height); // target area as dst
			program.run();
		}

		if(!param.alphaLock&&param.mode!=GLTextureBlender.ERASE) { // extend dst valid area, but not larger than dst size
			const extArea=GLProgram.borderIntersection(src.validArea,tA); // part blended
			const tmpArea=GLProgram.extendBorderSize(extArea,dst.validArea); // new valid area extended
			dst.validArea=GLProgram.borderIntersection(tmpArea,dst); // trim in dst borders
		}
	}

	/**
	 * Blending that cannot be done with simple blendFunc()
	 * and has to follow Porter Duff Compositing Operators and blend mode functions
	 * @param {*} src 
	 * @param {*} dst 
	 * @param {*} param 
	 */
	advancedBlendTexture(src,dst,param){
		const gl=this.gl;
		const programB=this.advancedBlendProgram;
		const tmp=this.renderer.tmpImageData;

		// ============= Step 1: Blending ================

		// move tmp so that it contains the most part in the viewport
		const tA=param.targetArea; // the area that changes
		// round to int
		tA.left=Math.floor(tA.left);
		tA.top=Math.floor(tA.top);
		tA.width=Math.ceil(tA.width);
		tA.height=Math.ceil(tA.height);

		const l1=tA.left;
		const l2=tA.left+tA.width-tmp.width;
		tmp.left=0;
		if(l1>0) tmp.left=l1;
		if(l2<0) tmp.left=l2;

		const t1=tA.top;
		const t2=tA.top+tA.height-tmp.height;
		tmp.top=0;
		if(t1>0) tmp.top=t1;
		if(t2<0) tmp.top=t2;

		// Set uniforms
		programB.setTargetTexture(tmp.data);
		programB.setSourceTexture("u_image_0",src.data);
		programB.setSourceTexture("u_image_1",dst.data);
		programB.setUniform("u_image_alpha",param.srcAlpha);
		programB.setUniform("u_blend_mode",param.mode); // according to blend mode enums
		// Set attributes
		const srcRect=GLProgram.getAttributeRect(tA,src,!param.antiAlias);
		const dstRect=GLProgram.getAttributeRect(tA,dst,!param.antiAlias);
		const tmpRect=GLProgram.getAttributeRect(tA,tmp,!param.antiAlias);
		programB.setAttribute("a_pos_0",srcRect,2);
		programB.setAttribute("a_pos_1",dstRect,2);
		programB.setAttribute("a_pos_tgt",tmpRect,2);

		gl.blendFunc(gl.ONE,gl.ZERO); // src only
		gl.viewport(0,0,tmp.width,tmp.height); // temp texture as dst
		programB.run();

		// ============= Step 2: Composition ================
		// now tmp contains modified source
		const programC=this.blendProgram;
		programC.setTargetTexture(dst.data);
		programC.setSourceTexture("u_image",tmp.data);
		programC.setUniform("u_image_alpha",1);

		// set target area attribute, to 0~1 coord space(LB origin).
		// gl will automatically trim within viewport
		programC.setAttribute("a_src_pos",GLProgram.getAttributeRect(tA,tmp,!param.antiAlias),2);
		programC.setAttribute("a_dst_pos",GLProgram.getAttributeRect(tA,dst,!param.antiAlias),2);

		gl.viewport(0,0,dst.width,dst.height); // target area as dst
		if(param.alphaLock){ // source-atop
			gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
		}
		else{ // source-over
			gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
		}
		programC.run();
	}
}

// Mode enums, shall be the same def as BasicRenderer
GLTextureBlender.AVERAGE=-3;
GLTextureBlender.ERASE=-2;
GLTextureBlender.NONE=-1;
GLTextureBlender.SOURCE=1;
GLTextureBlender.NORMAL=BasicRenderer.NORMAL;
GLTextureBlender.MULTIPLY=BasicRenderer.MULTIPLY;
GLTextureBlender.SCREEN=BasicRenderer.SCREEN;
GLTextureBlender.OVERLAY=BasicRenderer.OVERLAY;
GLTextureBlender.HARD_LIGHT=BasicRenderer.HARD_LIGHT;
GLTextureBlender.SOFT_LIGHT=BasicRenderer.SOFT_LIGHT;
GLTextureBlender.DARKEN=BasicRenderer.DARKEN;
GLTextureBlender.LIGHTEN=BasicRenderer.LIGHTEN;
GLTextureBlender.DIFFERENCE=BasicRenderer.DIFFERENCE;
GLTextureBlender.EXCLUSION=BasicRenderer.EXCLUSION;
GLTextureBlender.COLOR_DODGE=BasicRenderer.COLOR_DODGE;
GLTextureBlender.COLOR_BURN=BasicRenderer.COLOR_BURN;


class GLImageDataFactory {
	/**
	 * Load an Image / ImageData into GL texture based image data
	 * Output GL texture based image data as basic ImageData Object
	 * 
	 * These functions are all time consuming! Reduce the use.
	 */
	constructor(gl,dataFormat) {
		this.gl=gl;
		this.dataFormat=dataFormat;
		// draw source 
		const vConverterShaderSource=glsl` // vertex shader for drawing a circle
			attribute vec2 a_position; // vertex position
			attribute vec2 a_src_position; // vertex position
			varying vec2 v_position;
			void main(){
				v_position=a_src_position; // to Context2D ImageData order
				vec2 clipPos=(a_position*2.-1.)*vec2(1.,-1.);
				gl_Position=vec4(clipPos,0.,1.); // to clip space
			}
		`;
		const fConverterShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image;
			uniform float u_is_premult; // 1: premult->none alpha, 0: not change
			uniform float u_range; // target range 0~u_range
			varying vec2 v_position;
			void main(){
				vec4 pix=texture2D(u_image,v_position); // float operation
				if(u_is_premult!=0.){
					gl_FragColor=pix*u_range;
				}
				else if(pix.w!=0.){
					gl_FragColor=vec4(pix.xyz/pix.w,pix.w)*u_range;
				}
				else{
					gl_FragColor=vec4(0.,0.,0.,0.);
				}
			}
		`;
		this.converterProgram=new GLProgram(this.gl,vConverterShaderSource,fConverterShaderSource);
		this.converterProgram.setAttribute("a_position",[0,0,1,0,0,1,0,1,1,0,1,1],2);
		// a_position shall be the same rect order as a_src_position (getAttributeRect)
	}

	free() {
		this.converterProgram.free();
	}

	/**
	 * src is a gl renderer img data
	 * translate the whole src contents into Uint8
	 * targetSize is [w,h]. if not specified, then regarded as same as srcRange.
	 * srcRange is {left,top,width,height}, the range to copy from source
	 * Use nearest neighbor interpolation for zooming in/out
	 * return non-premultiplied uint8 result, y-flipped from GL Texture as default
	 */
	imageDataToUint8(src,srcRange,targetSize,isResultPremultAlpha) {
		const gl=this.gl;
		const program=this.converterProgram;

		srcRange=srcRange||src; // init: same as src
		targetSize=targetSize||[srcRange.width,srcRange.height]; // init: same as srcRange
		isResultPremultAlpha=isResultPremultAlpha||false;
		const [W,H]=targetSize;
		if(!(W&&H)){
			return new Uint8ClampedArray();
		}
		
		// Setup temp texture for extracting data
		const tmpTexture=GLProgram.createAndSetupTexture(gl);
		gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,this.dataFormat,null);

		// Run program to get a zoomed texture
		program.setSourceTexture("u_image",src.data);
		program.setTargetTexture(tmpTexture); // draw to canvas
		program.setUniform("u_is_premult",isResultPremultAlpha?1:0); // pre -> non-pre
		const attrRect=GLProgram.getAttributeRect(srcRange,src);
		program.setAttribute("a_src_position",attrRect,2);
		switch(this.dataFormat) {
			case gl.FLOAT: program.setUniform("u_range",255.999); break; // map 0.0~1.0 to 0~255.
			// Not 256 because some browser don't accept Uint8ClampedArray, and 256 cause overflow
			case gl.UNSIGNED_SHORT_4_4_4_4: // @TODO: support these formats
			case gl.HALF_FLOAT: break;
			case gl.UNSIGNED_BYTE: program.setUniform("u_range",1); break;
		}
		gl.viewport(0,0,W,H); // set size to target
		gl.blendFunc(this.gl.ONE,this.gl.ZERO); // copy
		program.run();

		// allocate proper buffer
		const SIZE=W*H*(this.dataFormat==gl.UNSIGNED_SHORT_4_4_4_4? 1:4);
		let pixelsF;
		switch(this.dataFormat) {
			case gl.FLOAT: pixelsF=new Float32Array(SIZE); break;
			case gl.UNSIGNED_SHORT_4_4_4_4:
			case gl.HALF_FLOAT: pixelsF=new Uint16Array(SIZE); break;
			case gl.UNSIGNED_BYTE: pixelsF=new Uint8Array(SIZE); break;
		}

		// read pixels from texture, takes time (~3ms)
		gl.readPixels(0,0,W,H,gl.RGBA,this.dataFormat,pixelsF); // read from buffer
		gl.deleteTexture(tmpTexture);

		// format transform
		switch(this.dataFormat) {
			case gl.FLOAT:
				return new Uint8ClampedArray(pixelsF);
			case gl.UNSIGNED_BYTE: // same
				return pixelsF;
			case gl.UNSIGNED_SHORT_4_4_4_4: // @TODO: unsupported yet
			case gl.HALF_FLOAT:
			default:
				return null;
		}
	}

	/**
	 * src is a gl renderer img data
	 * return premultiplied, Y-non-flipped (raw) result
	 * the result is a typed array of this.dataFormat
	 */
	imageDataToBuffer(src) {
		const gl=this.gl;

		if(!(src.width&&src.height)) { // empty
			switch(this.dataFormat) {
				case gl.FLOAT: return new Float32Array(0);
				case gl.UNSIGNED_SHORT_4_4_4_4:
				case gl.HALF_FLOAT: return new Uint16Array(0);
				case gl.UNSIGNED_BYTE: return new Uint8Array(0);
			}
		}

		// start converting
		const program=this.converterProgram;
		program.setTargetTexture(src.data,src.width,src.height);
		gl.viewport(0,0,src.width,src.height); // set size to src

		const SIZE=src.width*src.height*(this.dataFormat==gl.UNSIGNED_SHORT_4_4_4_4? 1:4);
		let pixels;
		switch(this.dataFormat) {
			case gl.FLOAT: pixels=new Float32Array(SIZE); break;
			case gl.UNSIGNED_SHORT_4_4_4_4:
			case gl.HALF_FLOAT: pixels=new Uint16Array(SIZE); break;
			case gl.UNSIGNED_BYTE: pixels=new Uint8Array(SIZE); break;
		}
		gl.readPixels(0,0,src.width,src.height,gl.RGBA,this.dataFormat,pixels); // read from buffer
		
		return pixels;
	}

	//src is a GLRAMBuf, tgt is a GLTexture. load the contents of src into tgt
	// loadRAMBufToTexture(src,tgt) {
	// 	if(tgt.type!="GLTexture") {
	// 		throw new Error("Cannot load data into "+tgt.type);
	// 	}
	// 	const gl=this.gl;
	// 	// Setup temp texture for extracting data
	// 	const tmpTexture=GLProgram.createAndSetupTexture(gl);
	// 	gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,src.width,src.height,0,gl.RGBA,this.dataFormat,src.data);

	// 	const tmpImageData={ // create a GLTexture copy of src
	// 		type: "GLTexture",
	// 		data: tmpTexture,
	// 		width: src.width,
	// 		height: src.height,
	// 		left: src.left,
	// 		top: src.top,
	// 		validArea: src // borrow values
	// 	}
		
	// 	gl.deleteTexture(tmpTexture);
	// }

	// get a new GLRAMBuf (with similar ids) from texture
	/**
	 * src is a gl renderer img data
	 * return premultiplied, Y-non-flipped (raw) result (quite large!)
	 * targetArea is the range to extract imageData {width,height,left,top}, in paper coordinate
	 * ** NOTE **
	 * if the targetArea is out of the src size range, then only the intersection part will be clipped
	 */
	getRAMBufFromTexture(src,targetArea) {
		const gl=this.gl;
		targetArea=targetArea||{
			width: src.width,
			height: src.height,
			left: src.left,
			top: src.top
		};
		const area=GLProgram.borderIntersection(src,targetArea); // clip out the intersection part
		if(area.width<0)area.width=0;
		if(area.height<0)area.height=0;

		let data;
		const SIZE=area.width*area.height*(this.dataFormat==gl.UNSIGNED_SHORT_4_4_4_4? 1:4);
		switch(this.dataFormat) {
			case gl.FLOAT: data=new Float32Array(SIZE); break;
			case gl.UNSIGNED_SHORT_4_4_4_4:
			case gl.HALF_FLOAT: data=new Uint16Array(SIZE); break;
			case gl.UNSIGNED_BYTE: data=new Uint8Array(SIZE); break;
		}
		if(SIZE) { // start converting
			const program=this.converterProgram;
			program.setTargetTexture(src.data);
			gl.viewport(0,0,src.width,src.height); // set size to src
			const glArea=[area.left-src.left,src.top+src.height-area.top-area.height,area.width,area.height];
			gl.readPixels(...glArea,gl.RGBA,this.dataFormat,data); // read from buffer
		}

		return {
			type: "GLRAMBuf",
			data: data, // creates a copy
			id: src.id, // here, imgData of same id may appear: don't use this as a hash!
			width: area.width,
			height: area.height,
			left: area.left,
			top: area.top,
			bitDepth: src.bitDepth,
			tagColor: src.tagColor, // same color
			validArea: {...area}
		};
	}

	// Convert target into a GLRAMBuf type imagedata
	convertGLTextureToRAMBuf(target) {
		const data2D=this.imageDataToBuffer(target);
		const texture=target.data;
		target.type="GLRAMBuf";
		target.data=data2D;
		this.gl.deleteTexture(texture);
	}

	convertGLRAMBufToTexture(target) {
		const gl=this.gl;
		const texture=GLProgram.createAndSetupTexture(gl);
		gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,target.width,target.height,0,gl.RGBA,this.dataFormat,target.data);
		target.type="GLTexture";
		target.data=texture;
		//console.log("RAM->TEX",target);
	}

	// ============== Loading functions ==============
	/**
	 * Load the img into the target image data
	 * img can be Context2D ImageData / HTMLImageElement / HTMLCanvasElement / ImageBitmap
	 * // @TODO: restrict the input size.
	 */
	loadToImageData(target,img) {
		try {
			const gl=this.gl;
			gl.bindTexture(gl.TEXTURE_2D,target.data);
			gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,this.dataFormat,img);
			target.width=img.width;
			target.height=img.height;
			target.validArea={
				width: img.width,
				height: img.height,
				left: target.left,
				top: target.top
			};
		} catch(err) {
			console.warn(img);
			console.err(err);
		}
	}

	// ===================== Other Utilities ========================
	/**
	 * Get a range as small as possible that covers all non-zero pixels
	 * return [l,r,u,b]: blank intervals in pixels. Shrinking the border these pixels won't delete non-zero pixel.
	 */
	getImageDataNonZeroRange() {

	}
}
