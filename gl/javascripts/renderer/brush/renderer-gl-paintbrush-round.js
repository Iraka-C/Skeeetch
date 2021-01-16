/**
 * Renderer for a round, paintbrush (brush with color sampling/inertia)
 */

class GLRoundPaintbrushRenderer extends GLGeneralBrushRenderer{
	initProgram() {
		const circleSliceN=64;
		const vCircleShaderSource=glsl` // vertex shader for drawing a circle
			#define DBPI 6.2831853071795864769 // 2*PI

			attribute float a_id; // vertex id: faceid*3+vertexid
			uniform float u_circle_slice_N; // slice number of a circle divided

			uniform vec2 u_res_tgt; // target texture resolution
			uniform vec3 u_pos_tgt; // circle position (x,y,r) in pixels

			varying float v_rel; // linear opacity interpolation
			void main(){
				vec2 d_pos;
				if(mod(a_id,3.)<0.5){ // 0' vertex
					d_pos=vec2(0.,0.);
					v_rel=1.;
				}
				else{ // 1',2' vertex
					float id=floor((a_id+1.1)/3.);
					float u=id/u_circle_slice_N; // 0~1
					float angle=u*DBPI;
					d_pos=vec2(cos(angle),sin(angle))*u_pos_tgt.z;
					v_rel=0.;
				}
				vec2 pos_tgt=u_pos_tgt.xy+d_pos; // in pixels, LU

				vec2 v_clip=(pos_tgt/u_res_tgt*2.-1.)*vec2(1.,-1.); // vertex pos in clip space

				gl_Position=vec4(v_clip,0.,1.);
			}
		`;

		const fCircleShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image; // sampling source texture
			uniform float u_softness; // circle edge softness
			uniform vec4 u_color; // rgba, UNMULTIPLIED!
			uniform float u_opa_tex; // sampling texture opacity

			uniform highp vec2 u_pos_tex; // sample position (x,y) in pixels
			uniform highp vec2 u_res_tex; // sampler texture resolution

			varying float v_rel;
			void main(){
				float opa;
				if(v_rel>=u_softness){ // get current color
					opa=1.;
				}
				else{
					float r=v_rel/u_softness;
					opa=clamp(r*r,0.,1.); // prevent NaN operation
				}

				vec2 coord_samp=u_pos_tex/u_res_tex; // sampling pos in sampler coordinate
				vec2 v_samp_tex=vec2(coord_samp.x,1.-coord_samp.y);

				vec4 cs=texture2D(u_image,v_samp_tex); // sample from texture
				vec4 cc=vec4(u_color.xyz,1.); // solid color
				vec4 cr=cc+(cs-cc)*u_opa_tex; // mix solid color, prevent dirty color
				gl_FragColor=cr*u_color.w*opa; // add opacity at last
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

	// ===================== Color sampling =======================
	render(target,brush,pos,prevPos,radius,colorRGB,opacity,pressure,isOpacityLocked,softRange){
		// Step 1: render colored brushtip to this.brushtipImageData
		const bImg=this.brushtipImageData;
		// set position
		bImg.left=pos[0]-radius-1;
		bImg.top=pos[1]-radius-1;
		bImg.validArea={
			width: radius*2+2,
			height: radius*2+2,
			left: bImg.left,
			top: bImg.top
		};
		
		const extension=isNaN(brush.extension)?1:brush.extension;
		const v=this.mainRenderer.quality/6;
		const eps=Math.min(-Math.log(1-extension)/v,1); // 0~inf, trunc at near 1
		const k=1-opacity;
		const b=1-(1-eps)*k;
		const a=b?k*eps/b:1; // in case b=0
		
		const color=[colorRGB[0],colorRGB[1],colorRGB[2],b.clamp(0,1)]; // pass in unmultiplied directly
		this.renderBrushtip(
			bImg,radius,color,softRange,
			target,pos,pos,a.clamp(0,1)
		);

		// Step 2: transfer brushtip to target
		this.mainRenderer.blendImageData(bImg,target,{
			mode: GLTextureBlender.NORMAL,
			alphaLock: isOpacityLocked,
			antiAlias: this.mainRenderer.antiAlias,
			srcAlpha: 1
		});
	}
	renderBrushtip(imgData,r,color,softRange,sampImgData,tgtPos,sampPos,sampOpacity) {
		const gl=this.gl;
		const program=this.program;

		program.setTargetTexture(imgData.data); // render to brushtip
		gl.viewport(0,0,imgData.width,imgData.height);
		gl.clearColor(0,0,0,0); // clear brushtip
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.blendFunc(gl.ONE,gl.ZERO); // pure source draw

		// Add 1 pix to brush imagedata edge to enable gl.LINEAR filtering at edges
		// afterall the target is 2px wider in canvas
		program.setUniform("u_res_tgt",[imgData.width,imgData.height]);
		program.setUniform("u_pos_tgt",[r+1,r+1,r]); // draw on left-top
		program.setUniform("u_color",color); // set circle color, alpha pre-multiply
		program.setUniform("u_softness",softRange);

		program.setSourceTexture("u_image",sampImgData.data); // sample from sampImgData
		program.setUniform("u_res_tex",[sampImgData.width,sampImgData.height]);
		program.setUniform("u_pos_tex",[sampPos[0]-sampImgData.left,sampPos[1]-sampImgData.top]);
		program.setUniform("u_opa_tex",sampOpacity); // sampling opacity factor
		program.run();
	}
}