/**
 * Renderer for a round, solid brush with color, opacity, and edge softness
 */

class GLRoundPencilBlockRenderer extends GLGeneralBrushRenderer{
	initProgram(){
		// slice number of a circle divided. Does not quite related with rendering speed.
		// 64 should be enough for an approximate circle
		const circleSliceN=64;
		const cN3=circleSliceN*3;

		// pos array is the vertices on a r=1 circle centered at (0,0)
		const vertexPosArray=new Float32Array(cN3*2);
		const vertexRelArray=new Float32Array(cN3);
		this.vertexPosArray=vertexPosArray;
		this.vertexRelArray=vertexRelArray;

		for(let i=0;i<cN3;i++){
			const i2=i*2;
			if(i%3){ // point on edge
				const id=Math.floor((i+1.5)/3);
				const angle=id*Math.PI*2/circleSliceN;
				vertexPosArray[i2]=Math.cos(angle);
				vertexPosArray[i2+1]=Math.sin(angle);
				vertexRelArray[i]=0;
			}
			else{ // center
				vertexPosArray[i2]=0;
				vertexPosArray[i2+1]=0;
				vertexRelArray[i]=1;
			}
		}

		// add the glsl codes inside a closure
		const vCircleShaderSource=glsl` // vertex shader for drawing a circle
			attribute vec2 a_pos; // according to vertexPosArray
			attribute float a_rel; // according to vertexRelArray
			attribute vec4 a_color; // rgba for this plate
			attribute float a_softness; // circle softness

			uniform vec2 u_res_tgt; // target canvas resolution

			varying float v_rel; // linear opacity interpolation
			varying vec4 v_color; // pass color
			varying float v_softness; // pass softness
			void main(){
				v_rel=a_rel;
				v_color=a_color;
				v_softness=a_softness;

				vec2 pos=a_pos;
				vec2 v_clip=(pos/u_res_tgt*2.0-1.0)*vec2(1.0,-1.0);
				gl_Position=vec4(v_clip,0.0,1.0);
			}
		`;

		const fCircleShaderSource=glsl`
			precision mediump float;
			//uniform vec4 u_color; // rgba
			varying float v_rel; // distance to circle center
			varying vec4 v_color; // pass color
			varying float v_softness; // circle edge softness
			void main(){
				//float opa=smoothstep(0.0,v_softness,v_rel); // sharper than following
				if(v_rel>=v_softness){
					gl_FragColor=v_color;
				}
				else{ // sample on this function averages to 1/3
					float r=v_rel/v_softness;
					float opa=clamp(r*r,0.0,1.0); // prevent NaN operation
					gl_FragColor=v_color*opa;
				}
			}
		`;
		// ================= Create program ====================
		const program=new GLProgram(this.gl,vCircleShaderSource,fCircleShaderSource);
		this.program=program;
	}

	renderPoints(target,brush,pointsInfo,isOpacityLocked){
		// Draw most 64 points at once
		// This value is based on the best performance on a laptop
		const BLOCK_SIZE=64;

		let changedArea={left:0,top:0,width:0,height:0};
		for(let i=0;i<pointsInfo.length;i+=BLOCK_SIZE){ // 16 points at most
			const A=this._renderPointsBlock(
				target,brush.blendMode,
				pointsInfo.slice(i,i+BLOCK_SIZE),isOpacityLocked
			);
			changedArea=GLProgram.extendBorderSize(changedArea,A);
		}

		if(!isOpacityLocked&&brush.blendMode>=0){ // extend valid area
			target.validArea=GLProgram.borderIntersection(
				GLProgram.extendBorderSize(changedArea,target.validArea),
				target // clamp by border
			);
		}
	}

	_renderPointsBlock(target,mode,pointsInfo,isOpacityLocked){
		if(!pointsInfo.length)return;

		const gl=this.gl;
		const program=this.program;

		// position of viewport
		let L=1000000;
		let T=1000000;
		let R=-1000000;
		let B=-1000000;
		for(const p of pointsInfo){
			const [x,y]=p.pos;
			const r=p.size;
			L=Math.min(L,x-r);
			R=Math.max(R,x+r);
			T=Math.min(T,y-r);
			B=Math.max(B,y+r);
		}

		// L,R,T,B relative to canvas window now
		L=Math.max(Math.floor(L-1),target.left);
		R=Math.min(Math.ceil(R+1),target.left+target.width);
		T=Math.max(Math.floor(T-1),target.top);
		B=Math.min(Math.ceil(B+1),target.top+target.height);

		const W=R-L;
		const H=B-T;

		program.setUniform("u_res_tgt",[W,H]); // minimum viewport required
		program.setTargetTexture(target.data); // render directly to imageData target
		gl.viewport(L-target.left,target.top+target.height-B,W,H); // set render range

		if(mode>=0){ // add
			if(isOpacityLocked){ // source atop
				gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
			}
			else{ // source over
				gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
			}
		}
		else{ // subtract
			if(isOpacityLocked){ // pure draw == source atop
				gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
			}
			else{ // dest out
				gl.blendFunc(gl.ZERO,gl.ONE_MINUS_SRC_ALPHA);
			}
		}

		// pointsInfo does not certainly contain BLOCK_SIZE points
		// initialize attribute arrays
		const N=pointsInfo.length;
		const M=this.vertexRelArray.length;
		const MN=M*N;
		const vPosArr=new Float32Array(2*MN);
		const vRelArr=new Float32Array(MN);
		const vColArr=new Float32Array(4*MN);
		const vSftArr=new Float32Array(MN);

		for(let i=0;i<N;i++){ // for each circle to be rendered
			const p=pointsInfo[i];
			// pre-mult color
			const colorRGB=p.color;
			const opacity=p.pointOpacity;
			const color=[colorRGB[0]*opacity,colorRGB[1]*opacity,colorRGB[2]*opacity,opacity];

			const x=p.pos[0]-L;
			const y=p.pos[1]-T;

			for(let j=0;j<M;j++){ // for each vertex (triangle*3)
				const b=i*M+j;
				vPosArr[b*2]=this.vertexPosArray[j*2]*p.size+x;
				vPosArr[b*2+1]=this.vertexPosArray[j*2+1]*p.size+y;
				vRelArr[b]=this.vertexRelArray[j];
				vSftArr[b]=p.softRange+p.aaRange;
				vColArr[b*4]=color[0];
				vColArr[b*4+1]=color[1];
				vColArr[b*4+2]=color[2];
				vColArr[b*4+3]=color[3];
			}
		}

		program.setAttribute("a_pos",vPosArr,2);
		program.setAttribute("a_rel",vRelArr,1);
		program.setAttribute("a_color",vColArr,4);
		program.setAttribute("a_softness",vSftArr,1);

		program.run();

		return { // changed area
			left: L,
			top: T,
			width: W,
			height: H
		}
	}
}