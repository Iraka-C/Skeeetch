class GLBrushRenderer{
	constructor(renderer){
		this.mainRenderer=renderer;
		this.gl=renderer.gl;
		this._initCircleProgram();
		this._initBlendProgram();

		const viewport=renderer.viewport;
		// originalImageData: storing the original raw image data
		this.originalImageData=renderer.createImageData(viewport.width,viewport.height);
		// storing the stroke buffer overlay
		this.strokeImageData=renderer.createImageData(viewport.width,viewport.height);
		// storing the actual shape (including size/opacity, etc) of every brushtip drawn
		const MAX_SIZE=BrushManager.limits.maxSize*2; // Maximum brushtip size
		this.brushtipImageData=renderer.createImageData(MAX_SIZE,MAX_SIZE);
	}

	_initCircleProgram() {
		// slice number of a circle divided
		const circleSliceN=64;

		// add the glsl codes inside a closure
		const vCircleShaderSource=glsl` // vertex shader for drawing a circle
			// circle id (not used) is the order of the circle to be drawn
			// face id is the order of the triangle in the circle
			// vertex id is the order of the vertex in a triangle (0,1,2)
			// OpenGL guarantees the primitive rasterization order same as VBO
			#define DBPI 6.2831853071795864769 // 2*PI

			attribute float a_id; // vertex id: faceid*3+vertexid

			uniform vec2 u_resolution; // canvas resolution
			uniform float u_circle_slice_N; // slice number of a circle divided

			uniform vec3 u_pos; // circle position (x,y,r) in pixels
			varying float rel; // linear opacity interpolation
			void main(){
				if(mod(a_id,3.0)<0.5){ // 0' vertex
					vec2 center_clip=(u_pos.xy/u_resolution*2.0-1.0)*vec2(1.0,-1.0);
					gl_Position=vec4(center_clip,0.0,1.0);
					rel=1.0;
				}
				else{ // 1',2' vertex
					float id=floor((a_id+1.0)/3.0);
					float u=id/u_circle_slice_N; // 0~1
					float angle=u*DBPI;
					vec2 d_pos=vec2(cos(angle),sin(angle))*u_pos.z;
					vec2 pos=u_pos.xy+d_pos;
					vec2 v_clip=(pos/u_resolution*2.0-1.0)*vec2(1.0,-1.0);
					gl_Position=vec4(v_clip,0.0,1.0);
					rel=0.0;
				}
			}
		`;

		const fCircleShaderSource=glsl`
			precision mediump float;
			uniform float u_softness; // circle edge softness
			uniform vec4 u_color; // rgba
			varying float rel;
			
			void main(){
				//float opa=smoothstep(0.0,u_softness,rel); // sharper than following
				if(rel>=u_softness){
					gl_FragColor=u_color;
				}
				else{ // sample on this function averages to 1/3
					float r=rel/u_softness;
					float opa=clamp(r*r,0.0,1.0); // prevent NaN operation
					gl_FragColor=u_color*opa;
				}
			}
		`;
		// ================= Create program ====================
		const program=new GLProgram(this.gl,vCircleShaderSource,fCircleShaderSource);
		this.circleProgram=program;
		// ================ Create buffer ================

		// prepare vertices id array
		const vertexIdArray=new Float32Array(circleSliceN*3);
		vertexIdArray.forEach((v,i) => {vertexIdArray[i]=i;});
		program.setAttribute("a_id",vertexIdArray,1);
		program.setUniform("u_circle_slice_N",circleSliceN);
	}

	_initBlendProgram(){
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
			uniform vec4 u_color; // rgba
			uniform float u_src_size; // source resolution
			uniform float u_tgt_size; // target resolution
			uniform float u_aa_size; // anti-aliasing window radius
			varying vec2 v_position;

			float getBrushPixel(vec2 pos){
				float dx=u_aa_size/u_tgt_size;
				vec2 d=vec2(dx,dx);
				vec2 newPos=(pos-d)/(1.-2.*d);
				if(newPos.x<0.0||newPos.x>1.0)return 0.0;
				if(newPos.y<0.0||newPos.y>1.0)return 0.0;
				return texture2D(u_image,newPos).w;
			}

			void main(){
				float sum=0.0; // only alpha channel
				float cnt=0.0;
				float p_step=u_aa_size/u_tgt_size*0.4;
				for(float i=-2.;i<=2.;i++){
					for(float j=-2.;j<=2.;j++){
						sum+=getBrushPixel(v_position+vec2(i,j)*p_step);
						cnt++;
					}
				}
				gl_FragColor=u_color*sum/cnt;
			}
		`;

		this.blendProgram=new GLProgram(this.gl,vBlendShaderSource,fBlendShaderSource);
		this.blendProgram.setAttribute("a_position",[0,0,1,0,0,1,0,1,1,0,1,1],2);
	}


	free(){
		this.circleProgram.free();
		this.blendProgram.free();
		this.mainRenderer.deleteImageData(this.originalImageData);
		this.mainRenderer.deleteImageData(this.strokeImageData);
		this.mainRenderer.deleteImageData(this.brushtipImageData);
	}

	setupBrushtip(brush,newBrushtip){
		if(!brush.brushtip){ // create brushtip
			brush.brushtip={type:"round"};
		}
		if(newBrushtip){ // change brushtip type
			if(newBrushtip.type="GLTexture"){ // set customized brushtip
				this._setupBrushtipCustomizedImageData(brush.brushtip,newBrushtip);
				return;
			}
			brush.brushtip.type=newBrushtip; // string of "round" or //??? @TODO
		}

		const gl=this.gl;
		const brushtip=brush.brushtip;

		// customized brushtip
		if(brushtip.type=="custom"){ // not changing
			return;
		}

		// internal type, deal with imageData
		if(brushtip.imageData){
			this.mainRenderer.deleteImageData(brushtip.imageData);
		}

		// different shapes
		if(brushtip.type=="round"){ // string specified type
		}
		else{
			// Other types
		}
	}
	_setupBrushtipCustomizedImageData(brush,imageData){
		brush.brushtip.type="custom";
	}


/**
	 * 
	 * @param {*} target 
	 * @param {*} brush 
	 * @param {*} pos brushtip center position in paper coordinate
	 * @param {*} size diameter of the brush
	 * @param {*} colorRGBA non pre-multiplied [r,g,b] in 0~1
	 * @param {*} isOpacityLocked 
	 * @param {*} softRange
	 */
	renderSolidPen(target,brush,pos,radius,colorRGB,opacity,isOpacityLocked,isAntiAlias){
		const gl=this.gl;
		const tImg=this.strokeImageData;

		/**
		 * Step 1. render a shape of certain color to strokeImageData
		 */

		if(brush.brushtip.type=="round"){
			const program=this.circleProgram;
			program.setTargetTexture(tImg.data); // render to target
			program.setUniform("u_resolution",[tImg.width,tImg.height]);
			gl.viewport(0,0,tImg.width,tImg.height);

			if(isAntiAlias&&radius<2){
				radius=0.6+radius*0.7;
			}
			program.setUniform("u_pos",[pos[0],pos[1],radius]);

			const color=brush.blendMode>=0?[...colorRGB,opacity]:[1,1,1,opacity];
			color[0]*=opacity;
			color[1]*=opacity;
			color[2]*=opacity;
			program.setUniform("u_color",color);
			gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); // always overlay

			const fixedSoftEdge=isAntiAlias?Math.min((brush.size+1)/4,2):0;
			const softRange=1-brush.edgeHardness+fixedSoftEdge/radius;
			program.setUniform("u_softness",softRange);
			program.run();

			// set tImg position
			tImg.validArea=GLProgram.borderIntersection(
				GLProgram.extendBorderSize(
					tImg.validArea,
					{ // area to draw in paper coordinate
						width: radius*2,
						height: radius*2,
						left: pos[0]-radius,
						top: pos[1]-radius
					}
				),
				tImg // clip inside the image data
			);
		}
		else{
			// @TODO: blabla...
		}

		/**
		 * Step 2. blend the originalImageData and strokeBuffer into rawImageData (target)
		 * Also handeled by COMPOSITER
		 */
		this.mainRenderer.clearImageData(target);
		this.mainRenderer.blendImageData(this.originalImageData,target,{
			mode: GLRenderer.SOURCE // copy
		});
		this.mainRenderer.blendImageData(tImg,target,{
			alphaLock: isOpacityLocked,
			mode: brush.blendMode>=0?GLRenderer.NORMAL:GLRenderer.ERASE // add or erase
		});
	}
	//=======================================
	/**
	 * 
	 * @param {*} target 
	 * @param {*} brush 
	 * @param {*} pos 
	 * @param {*} size diameter of the brush
	 * @param {*} colorRGBA Premultiplied [r,g,b,a] in 0~1
	 * @param {*} isOpacityLocked 
	 * @param {*} softRange 
	 */
	renderCircle_ref(target,brush,pos,radius,colorRGBA,isOpacityLocked,isAntiAlias){
		const gl=this.gl;

		const color=[...colorRGBA];
		if(brush.blendMode>=0) { // add: pen, brush, ...
			if(isOpacityLocked) { // destination opacity not change
				gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA); // a_dest doesn't change
			}
			else {
				gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); // normal blend mode *Lossy when 8bit int!
			}
		}
		else { // erase: eraser
			if(isOpacityLocked) { // destination opacity not change
				color=[color[3],color[3],color[3],color[3]]; // white
				gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA); // a_dest doesn't change
			}
			else {
				gl.blendFunc(gl.ZERO,gl.ONE_MINUS_SRC_ALPHA); // no color
			}
		}

		if(brush.brushtip.type=="round"){
			const program=this.circleProgram;
			program.setTargetTexture(target.data); // render to target
			program.setUniform("u_resolution",[target.width,target.height]);
			gl.viewport(0,0,target.width,target.height);

			if(isAntiAlias&&radius<2){
				radius=0.6+radius*0.7;
			}
			program.setUniform("u_pos",[pos[0],pos[1],radius]);
			program.setUniform("u_color",color);

			const fixedSoftEdge=isAntiAlias?Math.min((brush.size+1)/4,2):0;
			const softRange=1-brush.edgeHardness+fixedSoftEdge/radius;
			program.setUniform("u_softness",softRange);
			program.run();
			return;
		}

		
		const program=this.blendProgram;

		program.setTargetTexture(target.data); // render to this.texture
		// align viewport center with the imageData center
		//const radAA=isAntiAlias?Math.min((radius+1)/4,2):0;
		const radAA=radius<=5?0.5:1;
		const finalRadius=radius+radAA;
		gl.viewport(pos[0]-finalRadius+0.5,target.height-pos[1]-finalRadius+0.5,finalRadius*2,finalRadius*2);

		const source=brush.brushtip.imageData;
		program.setSourceTexture(source.data);
		program.setUniform("u_color",color); // set circle color, alpha pre-multiply
		program.setUniform("u_src_size",source.width); // source.width==source.height
		program.setUniform("u_tgt_size",finalRadius*2);
		program.setUniform("u_aa_size",radAA);
		program.run();
	}
}