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

/**
 * Convert the color in src to opacity
 * within the range of [left,top,width,height]
 * no larger than the viewport (tmpImageData)
 */
GLImageDataFactory.prototype._color2OpacityBlock=function(src,area){
	const gl=this.gl;
	const program=this.c2oProgram;

	const tmpImageData=this.renderer.tmpImageData;
	this.renderer.clearImageData(tmpImageData);

	// Setup temp texture for extracting data
	// align tmp with src.validArea
	tmpImageData.left=area.left;
	tmpImageData.top=area.top;

	program.setTargetTexture(tmpImageData.data);
	program.setAttribute("a_src_pos",GLProgram.getAttributeRect(area,src),2);
	program.setAttribute("a_dst_pos",GLProgram.getAttributeRect(),2);
	// set size to target (left-top)
	gl.viewport(0,tmpImageData.height-area.height,area.width,area.height);
	gl.blendFunc(gl.ONE,gl.ZERO); // copy
	program.run();

	// copy result back
	Object.assign(tmpImageData.validArea,area);
	this.renderer.blendImageData(tmpImageData,src,{mode: BasicRenderer.SOURCE});
}
GLImageDataFactory.prototype.color2Opacity=function(src){
	const W=src.validArea.width;
	const H=src.validArea.height;
	if(!(W&&H)) {
		return;
	}

	// render src by blocks
	const program=this.c2oProgram;
	const tmpImageData=this.renderer.tmpImageData;
	program.setSourceTexture("u_image",src.data);

	// copy result back
	const tW=tmpImageData.width;
	const tH=tmpImageData.height;
	for(let i=0;i<W;i+=tW){ // horizontal blocks
		for(let j=0;j<H;j+=tH){ // vertical blocks
			const targetArea={
				left: i+src.validArea.left,
				top: j+src.validArea.top,
				width: tW,
				height: tH
			};
			// convert one block of tmpImageData size
			this._color2OpacityBlock(src,GLProgram.borderIntersection(targetArea,src.validArea));
		}
	}
	// blend afterwards: needn't to change program during the following layer composition
}