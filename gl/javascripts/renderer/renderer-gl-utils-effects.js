"use strict";
GLImageDataFactory.prototype._initEffectProgram=function(){
	// Color to Opacity program
	const vc2oShaderSource=glsl`
		attribute vec2 a_dst_pos; // drawing area on target
		attribute vec2 a_src_pos; // sample area from source
		varying vec2 v_pos;
		void main(){
			v_pos=a_src_pos;
			gl_Position=vec4(a_dst_pos*2.-1.,0.,1.); // to clip space
		}
	`;
	const fc2oShaderSource=glsl`
		precision mediump float;
		precision mediump sampler2D;
		const vec4 WHITE=vec4(1.,1.,1.,1.);
		uniform sampler2D u_image;
		varying vec2 v_pos;
		void main(){
			vec4 pix=texture2D(u_image,v_pos);
			vec4 newPix=(1.-pix.w)*WHITE+pix;
			vec4 pixInv=WHITE-newPix;
			float newA=max(max(pixInv.x,pixInv.y),pixInv.z);
			gl_FragColor=WHITE*newA-pixInv;
		}
	`;
	this.c2oProgram=new GLProgram(this.gl,vc2oShaderSource,fc2oShaderSource);
};

GLImageDataFactory.prototype.color2Opacity=function(src){
	const gl=this.gl;
	const program=this.c2oProgram;
	const W=src.validArea.width;
	const H=src.validArea.height;
	if(!(W&&H)) {
		return;
	}

	// Setup temp texture for extracting data
	// align tmp with src.validArea
	const tmpImageData=this.renderer.tmpImageData;
	this.renderer.clearImageData(tmpImageData);
	tmpImageData.left=src.validArea.left;
	tmpImageData.top=src.validArea.top;

	// TODO: if tmpImageData smaller than src.validArea, use new texture.
	// Or, render src by blocks

	// Run program to get a zoomed texture
	program.setSourceTexture("u_image",src.data);
	program.setTargetTexture(tmpImageData.data);
	
	program.setAttribute("a_src_pos",GLProgram.getAttributeRect(src.validArea,src),2);
	program.setAttribute("a_dst_pos",GLProgram.getAttributeRect(),2);

	gl.viewport(0,tmpImageData.height-H,W,H); // set size to target (left-top)
	gl.blendFunc(gl.ONE,gl.ZERO); // copy
	program.run();

	// copy result back
	tmpImageData.validArea={
		width: W,
		height: H,
		left: tmpImageData.left,
		top: tmpImageData.top
	};
	this.renderer.clearImageData(src);
	this.renderer.blendImageData(tmpImageData,src,{mode: BasicRenderer.SOURCE});
	// blend afterwards: needn't to change program during the following layer composition
}