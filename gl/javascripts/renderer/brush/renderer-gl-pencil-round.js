/**
 * Renderer for a round, solid brush with color, opacity, and edge softness
 */

class GLRoundPencilRenderer{
	/**
	 * For rendering a round brushtip of a pencil
	 */
	constructor(brushRenderer){
		this.brushRenderer=brushRenderer;
		this.gl=brushRenderer.gl;
		// do not need brushtip image data

		this.initProgram();
	}

	initProgram(){
		// slice number of a circle divided. Does not quite related with rendering speed.
		// 64 should be enough for an approximate circle
		const circleSliceN=64;

		// add the glsl codes inside a closure
		const vCircleShaderSource=glsl` // vertex shader for drawing a circle
			// circle id (not used) is the order of the circle to be drawn
			// face id is the order of the triangle in the circle
			// vertex id is the order of the vertex in a triangle (0,1,2)
			// OpenGL guarantees the primitive rasterization order same as VBO
			#define DBPI 6.2831853071795864769 // 2*PI

			attribute float a_id; // vertex id: faceid*3+vertexid

			uniform vec2 u_res_tgt; // target canvas resolution
			uniform float u_circle_slice_N; // slice number of a circle divided

			uniform vec3 u_pos_tgt; // circle position (x,y,r) in pixels
			varying float v_rel; // linear opacity interpolation
			void main(){
				vec2 d_pos;
				if(mod(a_id,3.0)<0.5){ // 0' vertex
					d_pos=vec2(0.0,0.0);
					v_rel=1.0;
				}
				else{ // 1',2' vertex
					float id=floor((a_id+1.1)/3.0);
					float u=id/u_circle_slice_N; // 0~1
					float angle=u*DBPI;
					d_pos=vec2(cos(angle),sin(angle))*u_pos_tgt.z;
					v_rel=0.0;
				}
				vec2 pos=u_pos_tgt.xy+d_pos;
				vec2 v_clip=(pos/u_res_tgt*2.0-1.0)*vec2(1.0,-1.0);
				gl_Position=vec4(v_clip,0.0,1.0);
			}
		`;

		const fCircleShaderSource=glsl`
			precision mediump float;
			uniform float u_softness; // circle edge softness
			uniform vec4 u_color; // rgba
			varying float v_rel; // distance to circle center
			void main(){
				//float opa=smoothstep(0.0,u_softness,v_rel); // sharper than following
				if(v_rel>=u_softness){
					gl_FragColor=u_color;
				}
				else{ // sample on this function averages to 1/3
					float r=v_rel/u_softness;
					float opa=clamp(r*r,0.0,1.0); // prevent NaN operation
					gl_FragColor=u_color*opa;
				}
			}
		`;
		// ================= Create program ====================
		const program=new GLProgram(this.gl,vCircleShaderSource,fCircleShaderSource);
		this.program=program;
		// ================ Create buffer ================

		// prepare vertices id array
		const vertexIdArray=new Float32Array(circleSliceN*3);
		vertexIdArray.forEach((v,i) => {vertexIdArray[i]=i;});
		program.setAttribute("a_id",vertexIdArray,1);
		program.setUniform("u_circle_slice_N",circleSliceN);
	}

	render(target,brush,pos,prevPos,radius,colorRGB,opacity,pressure,isOpacityLocked,softRange){
		// Step 1: render colored brushtip to this.brushtipImageData
		// Step 2: transfer brushtip to target
		// ... Well, should be like this
		// Using only one shader program allows re-using set program: efficient
		
		let color=[colorRGB[0]*opacity,colorRGB[1]*opacity,colorRGB[2]*opacity,opacity];
		this.renderBrushtip(target,pos,radius,color,softRange,brush.blendMode,isOpacityLocked);

		// Update valid area
		// In other brushes, valid area update is made by blendTexture()
		if(!isOpacityLocked&&brush.blendMode>=0){ // valid area changed
			const R=radius+1; // extend 1 pixel for border
			const circleArea={
				width: R*2,
				height: R*2,
				left: pos[0]-R,
				top: pos[1]-R
			}
			target.validArea=GLProgram.borderIntersection(
				GLProgram.extendBorderSize(circleArea,target.validArea),
				target // clamp by border
			);
		}
	}

	// pos relative to viewport
	renderBrushtip(imgData,pos,r,color,softRange,mode,isOpacityLocked) {
		const gl=this.gl;
		const program=this.program;

		program.setTargetTexture(imgData.data); // render to brushtip
		//program.setUniform("u_res_tgt",[imgData.width,imgData.height]);
		//gl.viewport(0,0,imgData.width,imgData.height);
		const L=Math.round(pos[0]-imgData.left-r-1);
		const B=Math.round(imgData.top+imgData.height-pos[1]-r-1);
		const D=Math.ceil(r*2+2);
		program.setUniform("u_res_tgt",[D,D]); // minimum viewport required
		gl.viewport(L,B,D,D);
		// 1 step: do not clear texture
		if(mode>=0){ // add
			if(isOpacityLocked){ // source atop
				gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
			}
			else{ // source over
				gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
			}
		}
		else{ // subtract
			if(isOpacityLocked){ // pure draw
				gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
			}
			else{ // dest out
				gl.blendFunc(gl.ZERO,gl.ONE_MINUS_SRC_ALPHA);
			}
		}

		//program.setUniform("u_pos_tgt",[pos[0],pos[1],r]);
		program.setUniform("u_pos_tgt",[ // precise position in viewport
			pos[0]-imgData.left-L,
			pos[1]-imgData.top-(imgData.height-B-D),
			r
		]);
		program.setUniform("u_color",color); // set circle color, alpha pre-multiply
		program.setUniform("u_softness",softRange);
		program.run();
	}
}