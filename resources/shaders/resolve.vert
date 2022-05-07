#version 450

layout(location = 0) in vec4 vPosNorm;
layout(location = 1) in vec4 vTexCoordAndTang;

layout(push_constant) uniform params_t
{
    mat4 mProj;
    mat4 mView;
    mat4 mModel;
    vec4 color;
    vec4 lightPos;
    vec2 screenSize; 
} params;

layout (location = 0) out vec2 outUV;

void main() 
{
    vec3 pos   = (params.mModel * vec4(vPosNorm.xyz, 1.0f)).xyz;
    gl_Position   = params.mProj * params.mView * vec4(pos, 1.0);
}
