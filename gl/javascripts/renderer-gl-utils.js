/**
 * Class to blend two textures
 * Works in a same color space with linear blending
 */
class GLTextureBlender {
	// Mode enums, shall be the same def as BasicRenderer
	static NORMAL=0;
	static SOURCE=1;
	static MULTIPLY=2;
	static SCREEN=3;
	static EXCLUSION=10;

	constructor(gl) {
		// Normal or Copy version
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
			uniform sampler2D u_image;
			uniform float u_image_alpha;
			varying vec2 v_position;
			void main(){
				gl_FragColor=texture2D(u_image,v_position)*u_image_alpha;
			}
		`;

		this.gl=gl;
		this.blendProgram=new GLProgram(gl,vBlendShaderSource,fBlendShaderSource);
		this.blendProgram.setAttribute("a_position",[0,0,1,0,0,1,0,1,1,0,1,1],2);
		this.framebuffer=gl.createFramebuffer();
	}

	free(){
		this.blendProgram.free();
		this.gl.deleteFramebuffer(this.framebuffer);
	}
	/**
	 * blend the src and dst textures in corresponding ranges
	 * src, dst: imagedatas of this.gl
	 * param={
	 *    mode:
	 *       "source": use src to replace dst
	 *       "normal": 1*src+(1-src)*dst normal blend
	 *       "multiply": darken
	 *       "screen": lighten
	 *    alphaLock: true | false // to change the dst alpha
	 *    srcAlpha: additional opacity of source, 0~1
	 * }
	 * 
	 * **NOTE** if src range exceeds dst range, overflown parts will be discarded!
	 */
	blendTexture(src,dst,param) {
		if(!src.width||!src.height||!dst.width||!dst.height){ // one of the target contains zero pixel
			return; // needless to blend
		}
		
		const gl=this.gl;
		param.alphaLock=param.alphaLock||false;
		if(param.mode===undefined)param.mode=GLTextureBlender.NORMAL;
		if(param.srcAlpha===undefined)param.srcAlpha=1;

		let advancedBlendFlag=false;
		switch(param.mode) {
			case GLTextureBlender.SOURCE:
				if(param.alphaLock){ // do not change target alpha
					gl.blendFunc(gl.DST_ALPHA,gl.ZERO);
				}
				else{
					gl.blendFunc(gl.ONE,gl.ZERO); // copy
				}
				break;
			case GLTextureBlender.NORMAL:
				if(param.alphaLock){ // do not change target alpha
					gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA); // source-atop composition
				}
				else{
					gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); // normal alpha blend
				}
				break;
			case GLTextureBlender.SCREEN:
				if(param.alphaLock){
					advancedBlendFlag=true;
				}
				else{
					gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_COLOR); // screen color/alpha blend
				}
				break;
			case GLTextureBlender.EXCLUSION:
				if(param.alphaLock){
					advancedBlendFlag=true;
				}
				else{
					gl.blendFuncSeparate( // exclusion color/alpha blend
						gl.ONE_MINUS_DST_COLOR,gl.ONE_MINUS_SRC_COLOR,
						gl.ONE,gl.ONE_MINUS_SRC_ALPHA
					);
				}
				break;
			default:
				advancedBlendFlag=true;
		}

		if(advancedBlendFlag){
			// @TODO: need advanced composition shader
			return;
		}

		const program=this.blendProgram;
		program.setTargetTexture(dst.data);
		program.setSourceTexture(src.data);
		program.setUniform("u_image_alpha",param.srcAlpha);
		
		const left=Math.round(src.left-dst.left);
		const top=Math.round(dst.top+dst.height-src.top-src.height);
		gl.viewport(left,top,src.width,src.height);
		program.run();
	}
}

class GLImageDataFactory{
	/**
	 * Load an Image / ImageData into GL texture based image data
	 * Output GL texture based image data as basic ImageData Object
	 * 
	 * These functions are all time consuming! Reduce the use.
	 */
	constructor(gl,dataFormat){
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

	free(){
		this.converterProgram.free();
	}

	/**
	 * src is a gl renderer img data
	 * targetSize is [w,h]. if not specified, then regarded as same as src.
	 * targetRange is [left,top,width,height], the range to take data from targetSized output
	 * Use nearest neighbor interpolation for zooming in/out
	 * return non-premultiplied uint8 result, y-flipped from GL Texture
	 */
	imageDataToUint8(src,targetSize,targetRange) {
		const gl=this.gl;
		const program=this.converterProgram;
		let tmpTexture=null;
		if(!targetSize){ // init: same as source
			targetSize=[src.width,src.height];
		}
		if(!targetRange){ // init: same as targetSize
			targetRange=[0,0,targetSize[0],targetSize[1]];
		}
		else{
			targetRange=targetRange.slice(0,4);
		}
		let [W,H]=targetSize;

		// Setup temp texture for extracting data
		tmpTexture=GLProgram.createAndSetupTexture(gl);
		gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,this.dataFormat,null);

		// Run program to get a zoomed texture
		program.setSourceTexture(src.data,src.width,src.height);
		program.setTargetTexture(tmpTexture,W,H); // draw to canvas
		program.setUniform("u_is_premult",0);
		switch(this.dataFormat){
			case gl.FLOAT: program.setUniform("u_range",255.99);break; // map 0.0~1.0 to 0~255
			case gl.UNSIGNED_SHORT_4_4_4_4: // @TODO: support these formats
			case gl.HALF_FLOAT: break;
			case gl.UNSIGNED_BYTE: program.setUniform("u_range",1);break;
		}
		gl.viewport(0,0,W,H); // set size to target
		gl.blendFunc(this.gl.ONE,this.gl.ZERO); // copy
		program.run();

		// allocate proper buffer
		const SIZE=targetRange[2]*targetRange[3]*(this.dataFormat==gl.UNSIGNED_SHORT_4_4_4_4?1:4);
		let pixelsF;
		switch(this.dataFormat){
			case gl.FLOAT: pixelsF=new Float32Array(SIZE);break;
			case gl.UNSIGNED_SHORT_4_4_4_4:
			case gl.HALF_FLOAT: pixelsF=new Uint16Array(SIZE);break;
			case gl.UNSIGNED_BYTE: pixelsF=new Uint8Array(SIZE);break;
		}

		// read pixels from texture, takes time (~3ms)
		gl.readPixels(...targetRange,gl.RGBA,this.dataFormat,pixelsF); // read from buffer
		gl.deleteTexture(tmpTexture);

		// format transform
		switch(this.dataFormat){
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

	// src is a gl renderer img data
	// return premultiplied, Y-non-flipped (raw) result
	_imageDataToBuffer(src) {
		const gl=this.gl;
		if(!(src.width&&src.height)){ // empty texture
			switch(this.dataFormat){
				case gl.FLOAT:return new Float32Array(0);
				case gl.UNSIGNED_SHORT_4_4_4_4:
				case gl.HALF_FLOAT: return new Uint16Array(0);
				case gl.UNSIGNED_BYTE: return new Uint8Array(0);
			}
		}

		// start converting
		const program=this.converterProgram;
		program.setTargetTexture(src.data,src.width,src.height);
		gl.viewport(0,0,src.width,src.height); // set size to src

		const SIZE=src.width*src.height*(this.dataFormat==gl.UNSIGNED_SHORT_4_4_4_4?1:4);
		let pixels;
		switch(this.dataFormat){
			case gl.FLOAT:pixels=new Float32Array(SIZE);break;
			case gl.UNSIGNED_SHORT_4_4_4_4:
			case gl.HALF_FLOAT: pixels=new Uint16Array(SIZE);break;
			case gl.UNSIGNED_BYTE: pixels=new Uint8Array(SIZE);break;
		}
		gl.readPixels(0,0,src.width,src.height,gl.RGBA,this.dataFormat,pixels); // read from buffer

		return pixels;
	}

	// Convert target into a GLRAMBuf type imagedata
	convertGLTextureToRAMBuf(target){
		const data2D=this._imageDataToBuffer(target);
		const texture=target.data;
		target.type="GLRAMBuf";
		target.data=data2D;
		this.gl.deleteTexture(texture);
	}

	convertGLRAMBufToTexture(target){
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
	 */
	loadImageToImageData(target,img){
		try{
			const gl=this.gl;
			gl.bindTexture(gl.TEXTURE_2D,target.data);
			gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,this.dataFormat,img);
			target.width=img.width;
			target.height=img.height;
		}catch(err){
			console.warn(img);
			console.err(err);
		}
	}

	// ===================== Other Utilities ========================
	/**
	 * Get a range as small as possible that covers all non-zero pixels
	 * return [l,r,u,b]: blank intervals in pixels. Shrinking the border these pixels won't delete non-zero pixel.
	 */
	getImageDataNonZeroRange(){

	}
}
