/**
 * Class to blend two textures
 * Works in a same color space with linear blending
 */
class GLTextureBlender {
	constructor(gl,framebuffer) {
		this.gl=gl;
		this.framebuffer=framebuffer;
		this._initBlendProgram();
	}

	_initBlendProgram() {
		// add the glsl codes inside a closure
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
		// ================= Create program ====================
		this.blendProgram=WebGLUtils.createProgramFromScripts(
			this.gl,vBlendShaderSource,fBlendShaderSource);
		this.blendProgramBuffer={
			"a_position": this.gl.createBuffer()
		};
		// vertex order of a rectangle
		WebGLUtils.setBuffer(this.gl,this.blendProgramBuffer["a_position"],[0,0,1,0,0,1,0,1,1,0,1,1]);
	}

	/**
	 * blend the src and dst textures in corresponding ranges
	 * src, dst: textures of this.gl
	 * param={
	 *    mode:
	 *       "source": use src to replace dst
	 *       "normal": 1*src+(1-src)*dst normal blend
	 *       "multiply": darken
	 *       "screen": lighten
	 *    alphaLock: true | false // to change the dst alpha
	 *    srcAlpha: additional opacity of source, 0~1
	 * }
	 */
	blendTexture(src,dst,param/*,srcRange,dstRange*/) {
		const gl=this.gl;
		const program=this.blendProgram;
		gl.useProgram(program);

		param.alphaLock=param.alphaLock||false;
		param.mode=param.mode||"normal";
		if(param.srcAlpha===undefined)param.srcAlpha=1;

		switch(param.mode) {
			case "source":
				if(param.alphaLock){ // do not change target alpha
					gl.blendFunc(this.gl.DST_ALPHA,this.gl.ZERO);
				}
				else{
					gl.blendFunc(this.gl.ONE,this.gl.ZERO); // copy
				}
				break;
			case "normal":
				if(param.alphaLock){ // do not change target alpha
					gl.blendFunc(this.gl.DST_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA); // normal alpha blend
				}
				else{
					gl.blendFunc(this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA); // normal alpha blend
				}
				break;
			case "multiply":
			case "screen":
		}

		gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer); // render to a texture
		gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,dst,0);

		// prepare vertices id array
		WebGLUtils.setAttribute(gl,program,"a_position",this.blendProgramBuffer["a_position"],2);
		WebGLUtils.setUniformFloat(gl,program,"u_image_alpha",param.srcAlpha);

		gl.bindTexture(gl.TEXTURE_2D,src); // bind source
		gl.drawArrays(gl.TRIANGLES,0,6);
	}
}