/**
 * Histogram Calculator
 * Plug-in for GLRenderer
 */

/**
 * This calculator uses parallel pixel counting.
 * There are at most 1936 pools. Each pool counts the pixels from a piece of image.
 * Each piece is an area of (at most) 128x128.
 *     Supports to up to Sqrt(1936)*128=5632 length of textures.
 * The output value is 0~256, which corresponds to 1/64 of the actual countings.
 */

class GLHistogram {
	constructor(renderer){
		this.renderer=renderer;
		this.gl=renderer.gl;
		// copy
		const vHistShaderSource=glsl` // vertex shader for histogram
			attribute vec2 a_pos; // vertex pixel-size position
			varying vec2 v_pos;
			void main(){
				v_pos=a_pos;
				vec2 clipPos=(a_pos*2.-1.)*vec2(1.,-1.);
				gl_Position=vec4(clipPos,0.,1.); // to clip space
			}
		`;
		const fHistShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image;
			uniform float u_range; // target range 0~u_range
			varying highp vec2 v_pos;
			void main(){
				vec4 pix=texture2D(u_image,v_pos); // float operation
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
		this.histProgram=new GLProgram(this.gl,vHistShaderSource,fHistShaderSource);
		// full rectangular range
		this.histProgram.setAttribute("a_position",GLProgram.getAttributeRect(),2);

		this.histImageData=renderer.createImageData(256,1936); // fixed size, 1936 pools
	}

	/**
	 * calculate the histogram of imageData
	 * @param {GLTexture type} imageData
	 * returns an array of histogram [[R0~R255],[G0~G255],[B0~B255]], 3x256
	 */
	calcHistogram(imageData){

	}


}