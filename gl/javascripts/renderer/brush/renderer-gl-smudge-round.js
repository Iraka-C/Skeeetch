/**
 * Renderer for a round, smudge brush
 */

class GLRoundSmudgeRenderer extends GLGeneralBrushRenderer{
	initProgram() {
		const circleSliceN=64;
		const vCircleShaderSource=glsl` // vertex shader for drawing a circle
			#define DBPI 6.2831853071795864769 // 2*PI

			attribute float a_id; // vertex id: faceid*3+vertexid
			uniform float u_circle_slice_N; // slice number of a circle divided

			uniform vec2 u_res_tgt; // target texture resolution
			uniform vec3 u_pos_tgt; // circle position (x,y,r) in pixels
			uniform vec2 u_res_tex; // sampler texture resolution
			uniform vec2 u_pos_tex; // sample position (x,y) in pixels
			uniform vec2 u_pos_dst; // circle position (x,y) in pixels of the stamping dest pos

			varying float v_rel; // linear opacity interpolation
			varying vec2 v_samp_tex; // samping coordinate (0~1) (prev pos)
			varying vec2 v_samp_dst; // drawing target coordinate (0~1) (new pos)
			void main(){
				vec2 d_pos;
				if(a_id<5.5){ // first two bg triangles
					float R=u_pos_tgt.z+4.; // add more margin to cover
					float dX,dY;
					if(mod(a_id,2.)>0.5)dY=R; else dY=-R;
					if(a_id>1.5&&a_id<4.5)dX=R; else dX=-R;
					d_pos=vec2(dX,dY);
					v_rel=-1.;
				} // Following codes: a_id should -6 instead
				else if(mod(a_id,3.)<0.5){ // 0' vertex
					d_pos=vec2(0.,0.);
					v_rel=1.;
				}
				else{ // 1',2' vertex
					float id=floor((a_id-4.9)/3.); // should be -5., error containing
					float u=id/u_circle_slice_N; // 0~1
					float angle=u*DBPI;
					d_pos=vec2(cos(angle),sin(angle))*u_pos_tgt.z;
					v_rel=0.;
				}
				vec2 pos_tgt=u_pos_tgt.xy+d_pos; // in pixels, LU
				vec2 pos_tex=u_pos_tex+d_pos;
				vec2 pos_dst=u_pos_dst+d_pos;
				/** NOTE: add floor to these values creates very artistic effects */

				vec2 coord_samp=pos_tex/u_res_tex; // sampling pos in sampler coordinate
				vec2 coord_dst=pos_dst/u_res_tex;

				v_samp_tex=vec2(coord_samp.x,1.-coord_samp.y);
				v_samp_dst=vec2(coord_dst.x,1.-coord_dst.y);

				vec2 v_clip=(pos_tgt/u_res_tgt*2.-1.)*vec2(1.,-1.); // vertex pos in clip space
				gl_Position=vec4(v_clip,0.,1.);
			}
		`;

		const fCircleShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image; // sampling source texture
			uniform float u_softness; // circle edge softness
			uniform vec4 u_color; // rgba
			uniform float u_opa_tex; // sampling texture opacity

			varying float v_rel;
			varying highp vec2 v_samp_tex;
			varying highp vec2 v_samp_dst;

			// float random (vec2 st) {
			// 	return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123);
			// }

			void main(){
				vec4 dst_color=texture2D(u_image,v_samp_dst);
				if(v_rel<0.){ // bg triangle
					gl_FragColor=dst_color;
				}
				else {
					float opa;
					if(v_rel>=u_softness){ // get current color
						opa=u_opa_tex;
					}
					else{
						float r=v_rel/u_softness;
						opa=clamp(r*r,0.,1.)*u_opa_tex; // prevent NaN operation
					}

					vec4 samp_color=texture2D(u_image,v_samp_tex); // sample from texture
					samp_color=u_color*samp_color.w+samp_color*(1.-u_color.w); // add tint, opa unchanged
					gl_FragColor=dst_color+(samp_color-dst_color)*opa; // average blending
				}
			}
		`;
		// ================= Create program ====================
		const program=new GLProgram(this.gl,vCircleShaderSource,fCircleShaderSource);
		this.program=program;
		// ================ Create buffer ================

		// prepare vertices id array
		const vertexIdArray=new Float32Array(circleSliceN*3+6);
		vertexIdArray.forEach((v,i) => {vertexIdArray[i]=i;});
		program.setAttribute("a_id",vertexIdArray,1);
		program.setUniform("u_circle_slice_N",circleSliceN);
	}

	// ================= Stamp/Smudge ==================
	render(target,brush,pos,prevPos,radius,colorRGB,opacity,pressure,isOpacityLocked,softRange){
		const bImg=this.brushtipImageData;
		let color=[colorRGB[0]*opacity,colorRGB[1]*opacity,colorRGB[2]*opacity,opacity];

		// set position, must be pixel aligned or the edge gets blurry
		let bL=pos[0]-radius-2;
		bImg.left=Math.floor(bL-target.left)+target.left;
		let bT=pos[1]-radius-2;
		bImg.top=Math.floor(bT-target.top)+target.top;
		bImg.validArea={
			width: radius*2+2,
			height: radius*2+2,
			left: bImg.left+1,
			top: bImg.top+1
		};
		if(!this.mainRenderer.antiAlias){ // round to aligned pixels
			prevPos=[Math.round(prevPos[0]-pos[0])+pos[0],Math.round(prevPos[1]-pos[1])+pos[1]];
		}
		const extension=isNaN(brush.extension)?1:brush.extension;
		this.renderBrushtip(
			bImg,radius,color,softRange,
			target,pos,prevPos,
			extension*(brush.isAlphaPressure?pressure+(1-pressure)*brush.minAlpha:1)
		);
		this.mainRenderer.blendImageData(bImg,target,{
			mode: isOpacityLocked?GLTextureBlender.NORMAL:GLTextureBlender.SOURCE, // NORMAL avoid alpha loss
			alphaLock: isOpacityLocked,
			antiAlias: false, // pixel-aligned
		});
	}

	renderBrushtip(imgData,r,color,softRange,sampImgData,tgtPos,sampPos,sampOpacity){
		const gl=this.gl;
		const program=this.program;

		program.setTargetTexture(imgData.data); // render to brushtip
		gl.viewport(0,0,imgData.width,imgData.height); // @TODO: may shrink a little bit?
		gl.clearColor(0,0,0,0); // clear brushtip
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.blendFunc(gl.ONE,gl.ZERO); // pure source draw

		// Add 1 pix to brush imagedata edge to enable gl.LINEAR filtering at edges
		// afterall the target is 2px wider in canvas
		program.setUniform("u_res_tgt",[imgData.width,imgData.height]);
		program.setUniform("u_pos_tgt",[tgtPos[0]-imgData.left,tgtPos[1]-imgData.top,r]); // draw on left-top
		program.setUniform("u_color",color); // set circle color, alpha pre-multiply
		program.setUniform("u_softness",softRange);

		program.setSourceTexture("u_image",sampImgData.data); // sample from sampImgData
		program.setUniform("u_res_tex",[sampImgData.width,sampImgData.height]);
		program.setUniform("u_pos_tex",[sampPos[0]-sampImgData.left,sampPos[1]-sampImgData.top]);
		program.setUniform("u_pos_dst",[tgtPos[0]-sampImgData.left,tgtPos[1]-sampImgData.top]);
		program.setUniform("u_opa_tex",sampOpacity); // sampling opacity factor
		program.run();
	}

}