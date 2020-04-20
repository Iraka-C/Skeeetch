class GLBrushRenderer{
	constructor(renderer){
		this.mainRenderer=renderer;
		this.gl=renderer.gl;
		this._initCircleProgram();

		// originalImageData: for buffering stroke data
		//this.originalImageData=renderer.createImageData(viewport.width,viewport.height);
		// storing the shape of brush tip
		//this.strokeImageData=renderer.createImageData(viewport.width,viewport.height);
		const MAX_SIZE=BrushManager.limits.maxSize*2;
		this.brushtipImageData=renderer.createImageData(MAX_SIZE,MAX_SIZE); // fixed size
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
		this.mainRenderer.deleteImageData(this.brushtipImageData);
	}

	/**
	 * 
	 * @param {*} target 
	 * @param {*} brush 
	 * @param {*} pos [x,y] under paper coordinate
	 * @param {Number} radius diameter of the brush
	 * @param {[R,G,B,A]} colorRGBA Premultiplied [r,g,b,a] in 0~1
	 * @param {Boolean} isOpacityLocked 
	 * @param {Number} softRange 
	 */
	render(target,brush,pos,radius,colorRGBA,isOpacityLocked,softRange){
		const gl=this.gl;
		const program=this.circleProgram;

		// Step 1: render colored brushtip to this.brushtipImageData
		const bImg=this.brushtipImageData;
		program.setTargetTexture(bImg.data); // render to brushtip
		program.setUniform("u_resolution",[bImg.width,bImg.height]);
		gl.viewport(0,0,bImg.width,bImg.height);
		gl.clearColor(0,0,0,0); // clear brushtip
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.blendFunc(gl.ONE,gl.ZERO); // pure source draw

		let color;
		if(brush.blendMode>=0){
			color=colorRGBA; // do NOT change content of color!
		}
		else{
			const opa=colorRGBA[3];
			color=[opa,opa,opa,opa];
		}

		program.setUniform("u_pos",[radius,radius,radius]); // draw on left-top
		program.setUniform("u_color",color); // set circle color, alpha pre-multiply
		program.setUniform("u_softness",softRange);
		program.run();

		// Step 2: transfer brushtip to target
		// set position
		bImg.left=pos[0]-radius;
		bImg.top=pos[1]-radius;
		bImg.validArea={
			width: radius*2,
			height: radius*2,
			left: bImg.left,
			top: bImg.top
		};

		this.mainRenderer.blendImageData(bImg,target,{
			mode: brush.blendMode>=0?GLTextureBlender.NORMAL:GLTextureBlender.ERASE,
			alphaLock: isOpacityLocked
		});
	}
}