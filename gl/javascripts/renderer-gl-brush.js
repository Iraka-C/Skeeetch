class GLBrushRenderer{
	constructor(renderer){
		this.mainRenderer=renderer;
		this.gl=renderer.gl;
		this._initCircleProgram();

		const viewport=renderer.viewport;
		// originalImageData: for buffering stroke data
		this.originalImageData=renderer.createImageData(viewport.width,viewport.height);
		// storing the shape of brush tip
		this.strokeImageData=renderer.createImageData(viewport.width,viewport.height);
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

	free(){
		this.circleProgram.free();
		this.mainRenderer.deleteImageData(this.originalImageData);
		this.mainRenderer.deleteImageData(this.strokeImageData);
	}

	setupBrushtip(brush,newBrushtip){
		if(!brush.brushtip){ // create brushtip
			brush.brushtip={type:"round"};
		}
		if(newBrushtip){ // change brushtip type
			if(newBrushtip.type="GLTexture"){ // set customized brushtip
				this._setupBrushtipCustomizedImageData(brush,newBrushtip);
				return;
			}
			brush.brushtip.type=newBrushtip; // string of "round" or //??? @TODO
		}

		// customized brushtip
		if(brushtip.type=="custom"){ // not changing
			return;
		}

		// internal type
		if(brushtip.imageData.width!=MAX_SIZE||brushtip.imageData.height!=MAX_SIZE){
			// create texture of maximum size
			this.mainRenderer.deleteImageData(brushtip.imageData);
			brushtip.imageData=this.mainRenderer.createImageData(
				BrushManager.limits.maxSize,
				BrushManager.limits.maxSize
			);
		}
		else{ // simply clear it
			this.mainRenderer.clearImageData(brushtip.imageData,null,false);
		}

		const gl=this.gl;
		const brushtip=brush.brushtip;
		const MAX_SIZE=BrushManager.limits.maxSize;
		if(brushtip.type=="round"){ // string specified type
			const program=this.circleProgram;
			program.setTargetTexture(target.data); // render to this.texture
			program.setUniform("u_resolution",[target.width,target.height]);
			gl.viewport(0,0,target.width,target.height); // restore viewport
			gl.blendFunc(gl.ONE,gl.ZERO); // source only

			program.setUniform("u_pos",[MAX_SIZE/2,MAX_SIZE/2,MAX_SIZE/2]);
			program.setUniform("u_color",[1,1,1,1]); // white

			const softness=1-brush.edgeHardness;
			program.setUniform("u_softness",softness);
			program.run();
		}
		else{
			// Other types
		}
	}
	_setupBrushtipCustomizedImageData(brush,imageData){
		
	}

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
	render(target,brush,pos,size,colorRGBA,isOpacityLocked,softRange){
		const gl=this.gl;
		const program=this.circleProgram;

		program.setTargetTexture(target.data); // render to this.texture
		program.setUniform("u_resolution",[target.width,target.height]);
		gl.viewport(0,0,target.width,target.height); // restore viewport

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

		program.setUniform("u_pos",[pos[0],pos[1],size/2]);
		program.setUniform("u_color",color); // set circle color, alpha pre-multiply
		program.setUniform("u_softness",softRange);
		program.run();
	}
}