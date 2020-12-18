"use strict";
class GLBrushtipRenderer extends GLBrushRenderer{
	constructor(renderer){
		super(renderer);
		this._initBrushtipGenerationProgram();
	}

	/**
	 * Generate GLProgram that renders a brushtip texture from given imagedata source
	 */
	_initBrushtipGenerationProgram(){
		const gl=this.gl;
		const vShaderSource=glsl`
			void main(){
				gl_Position=vec4(0.); // to clip space
			}
		`;
		const fShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			varying highp vec2 v_pos;
			void main(){
				gl_FragColor=vec4(0.);
			}
		`;
		
		this.generateBrushtipProgram=new GLProgram(this.gl,vShaderSource,fShaderSource);
	}
}