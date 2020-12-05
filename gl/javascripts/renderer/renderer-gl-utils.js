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
			varying highp vec2 v_pos;
			void main(){
				if(v_pos.x<0.||v_pos.y<0.||v_pos.x>1.||v_pos.y>1.){ // out of bound, sharp cut
					gl_FragColor=vec4(0.,0.,0.,0.); // transparent
				}
				else{ // sample from u_image
					gl_FragColor=texture2D(u_image,v_pos)*u_image_alpha;
				}
			}
		`;
		// Use average of rgb values as brightness (SAI standard)
		const fBlendMaskShaderSource=glsl` // For masking blending
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image;
			uniform float u_image_alpha;
			varying highp vec2 v_pos;
			void main(){
				if(v_pos.x<0.||v_pos.y<0.||v_pos.x>1.||v_pos.y>1.){ // out of bound, sharp cut
					gl_FragColor=vec4(0.,0.,0.,1.); // no change
				}
				else{ // sample from u_image
					vec4 color=texture2D(u_image,v_pos)*u_image_alpha;
					float lum=(color.x+color.y+color.z)/3.; // x,y,z are pre-mult
					float final_alpha=1.-color.w+lum;
					gl_FragColor=vec4(0.,0.,0.,final_alpha);
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
			uniform vec4 u_neutral_color; // if provided, use neutral color to control filling
			uniform float u_alpha_lock; // 0: src over; 1: src atop
			varying highp vec2 v_pos_0; // vertex from src
			varying highp vec2 v_pos_1; // vertex from dst

			vec3 multiply(vec3 Cb,vec3 Cs){return Cb*Cs;} // #2
			vec3 screen(vec3 Cb,vec3 Cs){return Cb+Cs-Cb*Cs;} // #3
			vec3 darken(vec3 Cb,vec3 Cs){return min(Cb,Cs);} // #7
			vec3 lighten(vec3 Cb,vec3 Cs){return max(Cb,Cs);} // #8

			vec3 color_dodge(vec3 Cb,vec3 Cs){
				return clamp(Cb/(vec3(1.,1.,1.)-0.99999*Cs),0.,1.);
			} // #11 clamped, error<0.007
			vec3 color_burn(vec3 Cb,vec3 Cs){
				return vec3(1.,1.,1.)-clamp((vec3(1.,1.,1.)-Cb)/(Cs+vec3(1E-5,1E-5,1E-5)),0.,1.);
			} // #12 clamped, error<0.003
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
			// vec3 soft_light(vec3 Cb,vec3 Cs){
			// 	vec3 expB=pow(vec3(2.,2.,2.),vec3(1.,1.,1.)-2.*Cs);
			// 	return pow(Cb,Cs);
			// } // #6 Pegtop softlight
			vec3 difference(vec3 Cb,vec3 Cs){return abs(Cb-Cs);} // #9
			vec3 exclusion(vec3 Cb,vec3 Cs){return Cb+Cs-2.*Cb*Cs;} // #10

			vec3 linear_dodge(vec3 Cb,vec3 Cs){return min(Cb+Cs,1.);} // # 20
			vec3 linear_burn(vec3 Cb,vec3 Cs){return max(Cb+Cs-vec3(1.,1.,1.),0.);} // #21
			vec3 linear_light(vec3 Cb,vec3 Cs){return clamp(Cb+2.*Cs-vec3(1.,1.,1.),0.,1.);} // #22
			vec3 vivid_light(vec3 Cb,vec3 Cs){
				vec3 isDodge=step(0.5,Cs); // 1: Dodge, 0: burn
				vec3 cDodge=color_dodge(0.5*Cb,Cs);
				vec3 cBurn=color_burn(Cb,2.*Cs);
				return cDodge*isDodge+cBurn*(vec3(1.,1.,1.)-isDodge); // mix dodge & burn
			} // #23
			vec3 pin_light(vec3 Cb,vec3 Cs){
				vec3 isMax=step(0.5,Cs);
				vec3 cMax=max(2.*Cs-vec3(1.,1.,1.),Cb);
				vec3 cMin=min(2.*Cs,Cb);
				return isMax*cMax+(vec3(1.,1.,1.)-isMax)*cMin;
			} // #24
			vec3 darker_color(vec3 Cb,vec3 Cs){
				if(Cb.x+Cb.y+Cb.z<Cs.x+Cs.y+Cs.z){
					return Cb;
				}
				else{
					return Cs;
				}
			} // #25
			vec3 lighter_color(vec3 Cb,vec3 Cs){
				if(Cb.x+Cb.y+Cb.z>Cs.x+Cs.y+Cs.z){
					return Cb;
				}
				else{
					return Cs;
				}
			} // #26
			vec3 hard_mix(vec3 Cb,vec3 Cs){return step(1.,Cb+Cs);} // #27

			vec3 subtract(vec3 Cb,vec3 Cs){return max(Cb-Cs,0.);} // #30
			vec3 divide(vec3 Cb,vec3 Cs){return clamp(Cb/Cs,0.,1.);} // #31

			// Blend with u_blend_mode
			vec3 blend(vec3 Cb,vec3 Cs){
				vec3 Cm=vec3(0.,0.,0.); // blended result
				if(u_blend_mode<12.5){ // 0~12
					if(u_blend_mode<5.5){ // 2~5
						if(u_blend_mode<2.5) Cm=multiply(Cb,Cs);
						else if(u_blend_mode<3.5) Cm=screen(Cb,Cs);
						else if(u_blend_mode<4.5) Cm=hard_light(Cs,Cb); // overlay is inversed hard light
						else Cm=hard_light(Cb,Cs);
					}
					else if(u_blend_mode<8.5){ // 6~8
						if(u_blend_mode<6.5) Cm=soft_light(Cb,Cs);
						else if(u_blend_mode<7.5) Cm=darken(Cb,Cs);
						else Cm=lighten(Cb,Cs);
					}
					else{ // 9~12
						if(u_blend_mode<9.5) Cm=difference(Cb,Cs);
						else if(u_blend_mode<10.5) Cm=exclusion(Cb,Cs);
						else if(u_blend_mode<11.5) Cm=color_dodge(Cb,Cs);
						else Cm=color_burn(Cb,Cs);
					}
				}
				else if(u_blend_mode<27.5){ // 20~27
					if(u_blend_mode<23.5){ // 20~23
						if(u_blend_mode<20.5) Cm=linear_dodge(Cb,Cs);
						else if(u_blend_mode<21.5) Cm=linear_burn(Cb,Cs);
						else if(u_blend_mode<22.5) Cm=linear_light(Cb,Cs);
						else Cm=vivid_light(Cb,Cs);
					}
					else{ // 24~27
						if(u_blend_mode<24.5) Cm=pin_light(Cb,Cs);
						else if(u_blend_mode<25.5) Cm=darker_color(Cb,Cs);
						else if(u_blend_mode<26.5) Cm=lighter_color(Cb,Cs);
						else Cm=hard_mix(Cb,Cs);
						// Darker color, Lighter color, Hard mix
					}
				}
				else{ // 30~43
					if(u_blend_mode<31.5){ // 30~31
						if(u_blend_mode<30.5) Cm=subtract(Cb,Cs);
						else Cm=divide(Cb,Cs);
					}
					else{ // 40~43

					}
				}
				return Cm;
			}

			void main(){
				vec4 pix0=vec4(0.,0.,0.,0.); // src pixel
				vec4 pix1=vec4(0.,0.,0.,0.); // dst pixel
				if(v_pos_0.x>=0.&&v_pos_0.x<=1.&&v_pos_0.y>=0.&&v_pos_0.y<=1.){
					pix0=texture2D(u_image_0,v_pos_0)*u_image_alpha;
				}
				if(v_pos_1.x>=0.&&v_pos_1.x<=1.&&v_pos_1.y>=0.&&v_pos_1.y<=1.){
					pix1=texture2D(u_image_1,v_pos_1);
				}
				if(pix0.w==0.){
					gl_FragColor=pix1;
					return;
				}
				if(pix1.w==0.){
					if(u_alpha_lock>0.5){ // opa locked
						gl_FragColor=vec4(0.,0.,0.,0.);
					}
					else{ // normal blend
						gl_FragColor=pix0;
					}
					return;
				}

				float Xa=pix0.w+(1.-pix0.w)*pix1.w; // normal blend opacity
				float As=pix0.w; // record original opacity
				pix0+=u_neutral_color*(1.-pix0.w); // fill neutral color

				vec3 Cs=pix0.xyz/pix0.w; // premult => non premult
				vec3 Cb=pix1.xyz/pix1.w; // premult => non premultiplied

				vec3 Cm=blend(Cb,Cs); // step1: blend
				vec3 Cr=Cs+pix1.w*(Cm-Cs); // step2: interpolate
				vec4 cr=vec4(Cr,1.)*pix0.w; // non-premult => premult, pix0.w is already filled!

				vec4 c_blend=cr+pix1*(1.-cr.w); // normal blend color
				vec4 c_res=c_blend-u_neutral_color*(1.-Xa); // alpha = Xa, subtract neutral color
				if(u_alpha_lock>0.5){ // extract normal blend color, re-blend in src-atop
					vec4 c1=pix1*(1.-As); // contribution from pix1
					vec4 c0=c_res-c1; // original color
					gl_FragColor=c0*pix1.w+c1; // blend opa locked
				}
				else{ // normal blend
					gl_FragColor=c_res;
				}

			}
		`;

		this.gl=gl;
		this.blendProgram=new GLProgram(gl,vBlendShaderSource,fBlendShaderSource);
		this.blendMaskProgram=new GLProgram(gl,vBlendShaderSource,fBlendMaskShaderSource);
		this.advancedBlendProgram=new GLProgram(gl,vAdvancedBlendShaderSource,fAdvancedBlendShaderSource);
	}

	free() {
		this.blendProgram.free();
		this.blendMaskProgram.free();
		this.advancedBlendProgram.free();
	}
	/**
	 * blend the src and dst textures in corresponding ranges
	 * src, dst: imagedata of this.gl
	 * param={
	 *    mode: // see css mix-blend-mode standard
	 *       GLTextureBlender.SOURCE: use src to replace dst
	 *       GLTextureBlender.NORMAL: 1*src+(1-src)*dst normal blend
	 *       GLTextureBlender.EXCLUSION: color exclusion
	 *       GLTextureBlender.xxx: All other supported blend modes
	 *    alphaLock: true | false // to change the dst alpha
	 *    srcAlpha: additional opacity of source, 0~1
	 *    targetArea: the area to blend, {w,h,l,t} under paper coordinate. The smaller, the faster.
	 * }
	 * 
	 * **NOTE** if src range exceeds dst size range, overflown parts will be discarded! (but irrelevant to viewport)
	 * **NOTE** if not param.alphaLock, then the dst.validArea may change!
	 */
	blendTexture(src,dst,param) {
		if(!param.targetArea) param.targetArea=src.validArea; // blend all src valid pixels
		param.alphaLock=param.alphaLock||false;
		if(param.alphaLock||param.mode==GLTextureBlender.ERASE){ // only need to blend within dst.validArea
			param.targetArea=GLProgram.borderIntersection(param.targetArea,dst.validArea);
		}
		else{
			param.targetArea=GLProgram.borderIntersection(param.targetArea,dst);
		}
		if(!param.targetArea.width||!param.targetArea.height) { // target contains zero pixel
			return; // needless to blend
		}

		const gl=this.gl;
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
			case GLTextureBlender.MASK: // use source alpha
				gl.blendFunc(gl.ZERO,gl.SRC_ALPHA);
				break;
			default:
				advancedBlendFlag=true;
		}

		const tA=param.targetArea; // Do not change the contents!
		if(advancedBlendFlag) { // need advanced composition shader
			this.advancedBlendTexture(src,dst,param);
		}
		else { // blend with blendFunc
			// if is blending mask, use this.blendMaskProgram
			const program=(param.mode==GLTextureBlender.MASK)?this.blendMaskProgram:this.blendProgram;
			program.setTargetTexture(dst.data);
			program.setSourceTexture("u_image",src.data);
			program.setUniform("u_image_alpha",param.srcAlpha);

			// set target area attribute, to 0~1 coord space(LB origin).
			// gl will automatically trim within viewport
			// program.setAttribute("a_src_pos",GLProgram.getAttributeRect(tA,src,!param.antiAlias),2);
			// program.setAttribute("a_dst_pos",GLProgram.getAttributeRect(tA,dst,!param.antiAlias),2);

			// gl.viewport(0,0,dst.width,dst.height); // target area as dst
			const viewArea={ // round the target area
				left: Math.floor(tA.left),
				top: Math.floor(tA.top),
				width: Math.ceil(tA.width),
				height: Math.ceil(tA.height)
			}
			
			program.setAttribute("a_src_pos",GLProgram.getAttributeRect(tA,src,!param.antiAlias),2);
			program.setAttribute("a_dst_pos",GLProgram.getAttributeRect(tA,viewArea,!param.antiAlias),2);

			gl.viewport( // target area as tA
				viewArea.left-dst.left,
				dst.top+dst.height-viewArea.top-viewArea.height,
				viewArea.width,
				viewArea.height
			);

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
	 * blending area restricted in viewport size
	 * @param {*} src 
	 * @param {*} dst 
	 * @param {*} param 
	 */
	advancedBlendTexture(src,dst,param) {
		const gl=this.gl;
		const programB=this.advancedBlendProgram;
		const tmp=this.renderer.tmpImageData;
		this.renderer.clearImageData(tmp);

		// ============= Step 1: Blending & Composition ================

		// move tmp so that it contains the most part in the viewport
		let tA=param.targetArea; // the area that changes
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

		// within viewport
		tA=GLProgram.borderIntersection(tmp,tA);

		// Set uniforms
		programB.setTargetTexture(tmp.data);
		programB.setSourceTexture("u_image_0",src.data);
		programB.setSourceTexture("u_image_1",dst.data);
		programB.setUniform("u_image_alpha",param.srcAlpha);
		programB.setUniform("u_blend_mode",param.mode); // according to blend mode enums
		if(param.blendWithNeutralColor) {
			programB.setUniform("u_neutral_color",BasicRenderer.blendModeNeutralColor(param.mode));
		}
		else { // do not use neutral color
			programB.setUniform("u_neutral_color",[0,0,0,0]);
		}
		programB.setUniform("u_alpha_lock",param.alphaLock? 1:0);

		// Set attributes
		const srcRect=GLProgram.getAttributeRect(tA,src,!param.antiAlias);
		const dstRect=GLProgram.getAttributeRect(tA,dst,!param.antiAlias);
		const unitRect=GLProgram.getAttributeRect(); // unit rect
		programB.setAttribute("a_pos_0",srcRect,2);
		programB.setAttribute("a_pos_1",dstRect,2);
		programB.setAttribute("a_pos_tgt",unitRect,2);

		gl.blendFunc(gl.ONE,gl.ZERO); // src only
		gl.viewport(
			tA.left-tmp.left,
			tmp.top+tmp.height-tA.top-tA.height,
			tA.width,
			tA.height
		); // temp texture as dst
		programB.run();

		// ============= Step 2: copy ================
		// now tmp contains modified source
		const programC=this.blendProgram;
		programC.setTargetTexture(dst.data);
		programC.setSourceTexture("u_image",tmp.data);
		programC.setUniform("u_image_alpha",1);

		// set target area attribute, to 0~1 coord space(LB origin).
		// gl will automatically trim within viewport
		const tARect=GLProgram.getAttributeRect(tA,tmp,!param.antiAlias);
		programC.setAttribute("a_src_pos",tARect,2);
		programC.setAttribute("a_dst_pos",unitRect,2);

		gl.viewport(
			tA.left-dst.left,
			dst.top+dst.height-tA.top-tA.height,
			tA.width,
			tA.height
		); // target area as dst
		gl.blendFunc(gl.ONE,gl.ZERO); // copy
		programC.run();
	}
}

// Mode enums, shall be the same def as BasicRenderer
GLTextureBlender.AVERAGE=-3; // naive kS+(1-k)D method for non-alpha premultiplied texture
GLTextureBlender.ERASE=-2;
GLTextureBlender.NONE=-1;
GLTextureBlender.SOURCE=BasicRenderer.SOURCE;
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

// Non-basic
GLTextureBlender.LINEAR_DODGE=BasicRenderer.LINEAR_DODGE;
GLTextureBlender.LINEAR_BURN=BasicRenderer.LINEAR_BURN;
GLTextureBlender.LINEAR_LIGHT=BasicRenderer.LINEAR_LIGHT;
GLTextureBlender.VIVID_LIGHT=BasicRenderer.VIVID_LIGHT;
GLTextureBlender.PIN_LIGHT=BasicRenderer.PIN_LIGHT;
GLTextureBlender.DARKER_COLOR=BasicRenderer.DARKER_COLOR;
GLTextureBlender.LIGHTER_COLOR=BasicRenderer.LIGHTER_COLOR;
GLTextureBlender.HARD_MIX=BasicRenderer.HARD_MIX;
GLTextureBlender.SUBTRACT=BasicRenderer.SUBTRACT;
GLTextureBlender.DIVIDE=BasicRenderer.DIVIDE;
GLTextureBlender.HUE=BasicRenderer.HUE;
GLTextureBlender.SATURATION=BasicRenderer.SATURATION;
GLTextureBlender.COLOR=BasicRenderer.COLOR;
GLTextureBlender.LUMINOSITY=BasicRenderer.LUMINOSITY;

GLTextureBlender.MASK=BasicRenderer.MASK; // mask layer


class GLImageDataFactory {
	/**
	 * Load an Image / ImageData into GL texture based image data
	 * Output GL texture based image data as basic ImageData Object
	 * 
	 * These functions are all time consuming! Reduce the use.
	 */
	constructor(renderer) {
		this.renderer=renderer;
		this.gl=renderer.gl;
		this.dataFormat=renderer.dataFormat;

		this._initConverterProgram();

		// in utils-effects.js
		this._initEffectProgram();
	}

	_initConverterProgram(){
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
			varying highp vec2 v_position;
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
		this.converterProgram.setAttribute("a_position",GLProgram.getAttributeRect(),2);
		// a_position shall be the same rect order as a_src_position (in GLProgram.getAttributeRect)
	}

	// _initAAZoomProgram(){
	// 	const vZoomShaderSource=glsl`
	// 		attribute vec2 a_position; // the position (sample space) on the drawing target
	// 		attribute vec2 a_src_position; // the position (sample space) from the sampled source
	// 		varying vec2 v_position;
	// 		void main(){
	// 			v_position=a_position;
	// 			gl_Position=vec4(a_position*2.0-1.0,0.0,1.0); // to clip space
	// 		}
	// 	`;
	// 	const fZoomShaderSource=glsl`
	// 		precision mediump float;
	// 		precision mediump sampler2D;
	// 		uniform sampler2D u_image;
	// 		uniform vec2 u_aa_step; // anti-alias pixel interval (x,y) in sampler coordinate, may be non-int
	// 		uniform float u_aa_cnt; // how many steps to sample
	// 		varying highp vec2 v_position;

	// 		const float max_its=10.;
	// 		void main(){
	// 			float cnt=u_aa_cnt+1.;
	// 			vec4 totalColor=texture2D(u_image,v_position)*cnt;
	// 			float totalCnt=cnt;
	// 			for(float i=1.;i<max_its;i++){
	// 				if(i>=cnt)break; // counting finished
	// 				vec2 dPos=u_aa_step*i;
	// 				float k=cnt-i;
	// 				totalColor+=texture2D(u_image,v_position+dPos)*k;
	// 				totalColor+=texture2D(u_image,v_position-dPos)*k;
	// 				totalCnt+=k+k;
	// 			}
	// 			gl_FragColor=totalColor/totalCnt; // average pixel
	// 		}
	// 	`;
	// 	// ================= Create program ====================
	// 	this.canvasProgram=new GLProgram(this.gl,vCanvasShaderSource,fCanvasShaderSource);
	// 	this.canvasProgram.setAttribute("a_position",[0,0,1,0,0,1,0,1,1,0,1,1],2);
	// }

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
	imageDataToUint8(src,srcRange,targetSize,param) {
		const gl=this.gl;
		const program=this.converterProgram;

		srcRange=srcRange||src; // init: same as src
		targetSize=targetSize||[srcRange.width,srcRange.height]; // init: same as srcRange
		const [W,H]=targetSize;
		if(!(W&&H)) {
			return new Uint8ClampedArray();
		}

		param=param||{};
		param.isResultPremultAlpha=param.isResultPremultAlpha||false;
		param.isPreserveArrayType=param.isPreserveArrayType||false;

		// Setup temp texture for extracting data
		const tmpTexture=GLProgram.createAndSetupTexture(gl);
		gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,this.dataFormat,null);
		/**
		 * FIXME:
		 * DANGER!! this texture isn't monitored by VRAMManager: may cause VRAM overflow.
		 * Well... as the VRAMManager always tend to overestimate the usage of textures
		 * this texture at most takes... 480MB of VRAM (???)
		 * TODO:
		 * Use renderer.tmpImageData as the buffer, and give WARNING when size exceeds
		 * TODO:
		 * oncontextlost: give UI warnings and try to restore
		 */

		// Run program to get a zoomed texture
		program.setSourceTexture("u_image",src.data);
		program.setTargetTexture(tmpTexture); // draw to canvas
		program.setUniform("u_is_premult",param.isResultPremultAlpha? 1:0); // pre -> non-pre
		const attrRect=GLProgram.getAttributeRect(srcRange,src);
		program.setAttribute("a_src_position",attrRect,2);
		switch(this.dataFormat) {
			// Not 256 because some browser don't accept Uint8ClampedArray, and 256 cause overflow
			case gl.HALF_FLOAT:
			case gl.FLOAT: // map 0.0~1.0 to 0~255., avoid rounding (slow)
				program.setUniform("u_range",255.999);
				break;
			case gl.UNSIGNED_BYTE:
				program.setUniform("u_range",1);
				break;
		}
		gl.viewport(0,0,W,H); // set size to target
		gl.blendFunc(this.gl.ONE,this.gl.ZERO); // copy
		program.run();

		// allocate proper buffer
		const SIZE=W*H*4;
		let pixelsF;
		switch(this.dataFormat) {
			case gl.FLOAT: pixelsF=new Float32Array(SIZE); break;
			case gl.HALF_FLOAT: pixelsF=new Uint16Array(SIZE); break;
			case gl.UNSIGNED_BYTE: pixelsF=new Uint8Array(SIZE); break;
		}

		// read pixels from texture, takes time (~3ms)
		gl.readPixels(0,0,W,H,gl.RGBA,this.dataFormat,pixelsF); // read from buffer
		gl.deleteTexture(tmpTexture);

		// Decode Uint16 bin, suppose no negative / NaN / Inf
		// also, the value is to be changed into Uint8
		// if bin represents a subnormal value (<0.000060976), returns 0
		// if exp<15, the represented float must be <1: returns 0
		// If you REALLY want it to be even faster, try lookup tables ...

		// ((bin&0x3FF|0x400)<<exp)/0x400 equals
		// (1<<exp)*(1+(bin&0x3FF)/0x400), but the prior is faster
		function decodeFloat16(bin) {
			const exp=(bin>>>10)-15; // bin must represent a positive/0 float
			return exp>=0? ((bin&0x3FF|0x400)<<exp)/0x400:0;
		};

		// format transform
		if(param.isPreserveArrayType){ // preserve the original type of array
			return pixelsF; // return directly (may be put into WebWorker or ...)
		}
		switch(this.dataFormat) {
			case gl.FLOAT:
				// avoid directly using new Uint8ClampedArray(pixelsF)
				const res32=new Uint8ClampedArray(SIZE);
				// res32.set(pixelsF); // Don't use this either. Also slow
				for(let i=0;i<SIZE;i++) { // copy directly: fast
					res32[i]=pixelsF[i];
				}
				return res32;
			case gl.UNSIGNED_BYTE: // same
				return pixelsF;
			case gl.HALF_FLOAT: // decode half float
				const res16=new Uint8ClampedArray(SIZE);
				for(let i=0;i<SIZE;i++) {
					res16[i]=decodeFloat16(pixelsF[i]);
				}
				return res16;
			default:
				return null;
		}
	}

	/**
	 * src is a gl renderer img data
	 * return premultiplied, Y-non-flipped (raw) result
	 * the result is only a part of the src.validArea
	 * the result is a typed array of this.dataFormat
	 */
	imageDataToBuffer(src) {
		const gl=this.gl;
		const VW=src.validArea.width;
		const VH=src.validArea.hidth;


		if(!(VW&&VH)) { // empty
			switch(this.dataFormat) {
				case gl.FLOAT: return new Float32Array(0);
				case gl.HALF_FLOAT: return new Uint16Array(0);
				case gl.UNSIGNED_BYTE: return new Uint8Array(0);
			}
		}

		// start converting
		const program=this.converterProgram;
		program.setTargetTexture(src.data,src.width,src.height);
		gl.viewport(0,0,src.width,src.height); // set size to src

		const SIZE=VW*VH*4;
		let pixels;
		switch(this.dataFormat) {
			case gl.FLOAT: pixels=new Float32Array(SIZE); break;
			case gl.HALF_FLOAT: pixels=new Uint16Array(SIZE); break;
			case gl.UNSIGNED_BYTE: pixels=new Uint8Array(SIZE); break;
		}
		gl.readPixels(
			src.validArea.left-src.left,
			src.top+src.height-src.validArea.top-VH,
			VW,VH,gl.RGBA,this.dataFormat,pixels); // read from buffer

		return pixels;
	}

	// get a NEW GLRAMBuf (with similar ids) from texture
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
		if(area.width<0) area.width=0;
		if(area.height<0) area.height=0;

		let data;
		const SIZE=area.width*area.height*4;
		switch(this.dataFormat) {
			case gl.FLOAT: data=new Float32Array(SIZE); break;
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
	// This function will trim the area outside target.validArea
	// to get a smaller buffer
	convertGLTextureToRAMBuf(target) {
		const data2D=this.imageDataToBuffer(target);
		const texture=target.data;
		target.type="GLRAMBuf";
		target.data=data2D;
		Object.assign(target,target.validArea); // refresh dimensions as valid area only
		this.gl.deleteTexture(texture);
	}

	convertGLRAMBufToTexture(target) {
		const gl=this.gl;
		const texture=GLProgram.createAndSetupTexture(gl);
		gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,target.width,target.height,0,gl.RGBA,this.dataFormat,target.data);
		target.type="GLTexture";
		target.data=texture;
		//LOGGING&&console.log("RAM->TEX",target);
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
			LOGGING&&console.warn(img);
			LOGGING&&console.err(err);
		}
	}

	// ===================== Other Utilities ========================
	/**
	 * Renew the validArea of src.
	 * src.validArea may contain zero rows or columns due to erasing operation
	 * This function recalculates the area that contains no zero rows or columns
	 * Guarantees 8bit precision
	 * **NOTICE** using cpu calculation, slow
	 * return the new valid area
	 * @param {*} src 
	 */
	recalculateValidArea(src,minOpa) {
		/**
		 * The steps are:
		 * 1. change src into uint8 array, to consider only alpha channel
		 * 2. delete all-zero edges
		 */
		// Step 1: to alpha channel
		const img2D=this.imageDataToUint8(src,src.validArea); // get 2d data of all range, y-flipped
		const W=src.validArea.width;
		const H=src.validArea.height;
		const MIN_A=minOpa*255;

		// Step 2: detect zeros: zT > zB > zL > zR
		let [zL,zR,zT,zB]=[0,W-1,0,H-1]; // non-zero edge of L, R, T, B

		// zT
		for(let j=0;j<H;j++) {
			let isZero=true;
			let jID=j*W;
			for(let i=0;i<W;i++) { // test if any non-zeros
				const id=(jID+i)*4;
				if(img2D[id+3]>=MIN_A) {isZero=false; break;}
			}
			if(isZero) zT=j+1; // peek the next line
			else break;
		}

		if(zT==H) { // the whole image is empty
			return {
				left: src.validArea.left,
				top: src.validArea.top,
				width: 0,
				height: 0
			};
		}

		// zB > zT
		for(let j=H-1;j>=0;j--) {
			let isZero=true;
			let jID=j*W;
			for(let i=0;i<W;i++) {
				const id=(jID+i)*4;
				if(img2D[id+3]>=MIN_A) {isZero=false; break;}
			}
			if(isZero) zB=j-1; // peek the prev line
			else break;
		}

		// zL
		for(let i=0;i<W;i++) {
			let isZero=true;
			for(let j=zT;j<=zB;j++) {
				const id=(j*W+i)*4;
				if(img2D[id+3]>=MIN_A) {isZero=false; break;}
			}
			if(isZero) zL=i+1; // peek the next column
			else break;
		}

		// zR > zL
		for(let i=W-1;i>=0;i--) {
			let isZero=true;
			for(let j=zT;j<=zB;j++) {
				const id=(j*W+i)*4;
				if(img2D[id+3]>=MIN_A) {isZero=false; break;}
			}
			if(isZero) zR=i-1; // peek the prev column
			else break;
		}

		// now [zL,zR,zT,zB] contains the range of non-zero area

		// Step 3: reassign values
		return {
			left: src.validArea.left+zL,
			top: src.validArea.top+zT,
			width: zR-zL+1,
			height: zB-zT+1
		};
	}
}

/**
 * Homographic & similar transformation
 */
class GLTransformation {
	constructor(renderer) {
		this.gl=renderer.gl;
		this.dataFormat=renderer.dataFormat;

		this._initTransformProgram();
	}

	_initTransformProgram(){
		// draw source 
		const vTransformShaderSource=glsl`
			attribute vec2 a_position; // vertex position
			varying vec2 v_position;
			void main(){
				v_position=a_position;
				vec2 clipPos=(a_position*2.-1.)*vec2(1.,-1.);
				gl_Position=vec4(clipPos,0.,1.); // to clip space
			}
		`;
		const fTransformShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image;
			varying highp vec2 v_position;
			void main(){
				vec4 pix=texture2D(u_image,v_position);
				gl_FragColor=pix; // get the color
			}
		`;
		this.transformProgram=new GLProgram(this.gl,vTransformShaderSource,fTransformShaderSource);
		this.transformProgram.setAttribute("a_position",GLProgram.getAttributeRect(),2);
		// a_position shall be the same rect order as a_src_position (in GLProgram.getAttributeRect)
	}
}