#version 450
layout (triangles) in;
layout (line_strip, max_vertices = 2) out;

layout(push_constant) uniform params_t
{
    mat4 mProjView;
    mat4 mModel;
} params;

layout (location = 0 ) in VS_OUT
{
    vec3 wPos;
    vec3 wNorm;
    vec3 wTangent;
    vec2 texCoord;

} vIn[];

const float MAGNITUDE = 0.1f;

vec4 GetNormal()
{
   vec3 a = vec3(vIn[1].wPos) - vec3(vIn[0].wPos);
   vec3 b = vec3(vIn[2].wPos) - vec3(vIn[1].wPos);
   return vec4(normalize(cross(a, b)), 0.f);
}  

void main()
{
    vec3 A = vIn[0].wPos;
    vec3 B = vIn[1].wPos;
    vec3 C = vIn[2].wPos;

    vec4 center = vec4((A + B + C) / 3, 1.f);

    gl_Position = params.mProjView * center;
    EmitVertex();

    gl_Position = params.mProjView * (center + GetNormal() * MAGNITUDE);
    EmitVertex();

    EndPrimitive();
}  