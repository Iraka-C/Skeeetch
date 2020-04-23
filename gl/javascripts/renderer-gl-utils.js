/**
 * Class to blend two textures
 * Works in a same color space with linear blending
 */
class GLTextureBlender {
	// Enums at the end of class definition

	constructor(gl) {
		// Normal or Copy version
		// const vBlendShaderSource=glsl` // vertex shader for drawing a circle
		// 	attribute vec2 a_position; // vertex position
		// 	varying vec2 v_position;
		// 	void main(){
		// 		v_position=a_position;
		// 		gl_Position=vec4(a_position*2.-1.,0.,1.); // to clip space
		// 	}
		// `;
		const vBlendShaderSource=glsl`
			attribute vec2 a_dst_pos; // drawing area on target
			attribute vec2 a_src_pos; // sample area from source
			varying vec2 v_pos;
			void main(){
				v_pos=a_src_pos;
				gl_Position=vec4(a_dst_pos*2.-1.,0.,1.); // to clip space
			}
		`;
		// const fBlendShaderSource=glsl` // blend1
		// 	precision mediump float;
		// 	precision mediump sampler2D;
		// 	uniform sampler2D u_image;
		// 	uniform float u_image_alpha;
		// 	varying vec2 v_position;
		// 	void main(){
		// 		gl_FragColor=texture2D(u_image,v_position)*u_image_alpha;
		// 	}
		// `;
		const fBlendShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image;
			uniform float u_image_alpha;
			varying vec2 v_pos;
			void main(){
				if(v_pos.x<0.||v_pos.y<0.||v_pos.x>1.||v_pos.y>1.){ // out of bound
					gl_FragColor=vec4(0.,0.,0.,0.); // transparent
				}
				else{ // sample from u_image
					gl_FragColor=texture2D(u_image,v_pos)*u_image_alpha;
				}
			}
		`;

		this.gl=gl;
		this.blendProgram=new GLProgram(gl,vBlendShaderSource,fBlendShaderSource);
	}

	free() {
		this.blendProgram.free();
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
		if(!src.width||!src.height||!dst.width||!dst.height) { // one of the target contains zero pixel
			return; // needless to blend
		}

		const gl=this.gl;
		param.alphaLock=param.alphaLock||false;
		if(param.mode===undefined) param.mode=GLTextureBlender.NORMAL;
		if(param.srcAlpha===undefined) param.srcAlpha=1;
		if(param.antiAlias===undefined) param.antiAlias=true;
		if(!param.targetArea)param.targetArea=src.validArea; // blend all src valid pixels

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
				else {
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

		if(advancedBlendFlag) {
			// @TODO: need advanced composition shader
			return;
		}

		const program=this.blendProgram;
		program.setTargetTexture(dst.data);
		program.setSourceTexture(src.data);
		program.setUniform("u_image_alpha",param.srcAlpha);

		// set target area attribute, to 0~1 coord space(LB origin).
		// gl will automatically trim within viewport
		const tA=param.targetArea; // Do not change the contents!
		program.setAttribute("a_src_pos",GLProgram.getAttributeRect(tA,src,!param.antiAlias),2);
		program.setAttribute("a_dst_pos",GLProgram.getAttributeRect(tA,dst,!param.antiAlias),2);

		gl.viewport(0,0,dst.width,dst.height); // target area as dst
		program.run();

		if(!param.alphaLock) { // extend dst valid area, but not larger than dst size
			const extArea=GLProgram.borderIntersection(src.validArea,tA); // part blended
			const tmpArea=GLProgram.extendBorderSize(extArea,dst.validArea); // extend valid
			dst.validArea=GLProgram.borderIntersection(tmpArea,dst); // trim in dst borders
		}
	}
}

// Mode enums, shall be the same def as BasicRenderer
GLTextureBlender.NORMAL=BasicRenderer.NORMAL;
GLTextureBlender.AVERAGE=-3;
GLTextureBlender.ERASE=-2;
GLTextureBlender.NONE=-1;
GLTextureBlender.SOURCE=1;
GLTextureBlender.MULTIPLY=BasicRenderer.MULTIPLY;
GLTextureBlender.SCREEN=BasicRenderer.SCREEN;
GLTextureBlender.EXCLUSION=BasicRenderer.EXCLUSION;

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
			varying vec2 v_position;
			void main(){
				v_position=vec2(a_position.x,1.0-a_position.y); // flip Y
				gl_Position=vec4(a_position*2.0-1.0,0.0,1.0); // to clip space
			}
		`;
		const fConverterShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image;
			uniform float u_is_premult; // 1: premult alpha, 0: non-premult result
			uniform float u_range; // target range 0~u_range
			varying vec2 v_position;
			void main(){
				vec4 pix=texture2D(u_image,v_position); // float operation
				if(u_is_premult!=0.0){
					gl_FragColor=pix*u_range;
				}
				else if(pix.w!=0.0){
					gl_FragColor=vec4(pix.xyz/pix.w,pix.w)*u_range;
				}
				else{
					gl_FragColor=vec4(0.0,0.0,0.0,0.0);
				}
			}
		`;
		this.converterProgram=new GLProgram(this.gl,vConverterShaderSource,fConverterShaderSource);
		this.converterProgram.setAttribute("a_position",[0,0,1,0,0,1,0,1,1,0,1,1],2);
	}

	free() {
		this.converterProgram.free();
	}

	/**
	 * src is a gl renderer img data
	 * translate the whole src contents into Uint8
	 * targetSize is [w,h]. if not specified, then regarded as same as src.
	 * targetRange is [left,top,width,height], the range to take data from targetSized output
	 * Use nearest neighbor interpolation for zooming in/out
	 * return non-premultiplied uint8 result, y-flipped from GL Texture
	 */
	imageDataToUint8(src,targetSize,targetRange) {
		const gl=this.gl;
		const program=this.converterProgram;
		let tmpTexture=null;
		if(!targetSize) { // init: same as source
			targetSize=[src.width,src.height];
			//targetSize=[src.validArea.width,src.validArea.height];
		}
		if(!targetRange) { // init: same as targetSize
			targetRange=[0,0,targetSize[0],targetSize[1]];
		}
		else {
			targetRange=targetRange.slice(0,4);
		}
		let [W,H]=targetSize;
		
		// Setup temp texture for extracting data
		tmpTexture=GLProgram.createAndSetupTexture(gl);
		gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,this.dataFormat,null);

		// Run program to get a zoomed texture
		program.setSourceTexture(src.data);
		program.setTargetTexture(tmpTexture); // draw to canvas
		program.setUniform("u_is_premult",0);
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
		const SIZE=targetRange[2]*targetRange[3]*(this.dataFormat==gl.UNSIGNED_SHORT_4_4_4_4? 1:4);
		let pixelsF;
		switch(this.dataFormat) {
			case gl.FLOAT: pixelsF=new Float32Array(SIZE); break;
			case gl.UNSIGNED_SHORT_4_4_4_4:
			case gl.HALF_FLOAT: pixelsF=new Uint16Array(SIZE); break;
			case gl.UNSIGNED_BYTE: pixelsF=new Uint8Array(SIZE); break;
		}

		// read pixels from texture, takes time (~3ms)
		gl.readPixels(...targetRange,gl.RGBA,this.dataFormat,pixelsF); // read from buffer
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

	// src is a GLRAMBuf, tgt is a GLTexture. load the contents of src into tgt
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
	 * return premultiplied, Y-non-flipped (raw) result
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
