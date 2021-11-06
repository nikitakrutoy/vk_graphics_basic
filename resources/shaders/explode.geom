#version 450
layout (triangles) in;
layout (triangle_strip, max_vertices = 3) out;

layout(push_constant) uniform params_t
{
    mat4 mProjView;
    mat4 mModel;
} params;

layout (location = 0 ) in VS_OUT
{
    vec3 wPos;
    vec3 wTangent;
    vec2 texCoord;
    float dist;
} vIn[];

layout (location = 0 ) out VS_OUT
{
    vec3 wPos;
    vec3 wNorm;
    vec3 wTangent;
    vec2 texCoord;
} vOut;

const float MAGNITUDE = 0.1f;

vec3 GetNormal(vec3 v0, vec3 v1, vec3 v2)
{
   vec3 coef = vec3(v1) - vec3(v0);
   vec3 b = vec3(v2) - vec3(v1);
   return normalize(cross(coef, b));
}  

void main()
{
    vec3 A = vIn[0].wPos;
    vec3 B = vIn[1].wPos;
    vec3 C = vIn[2].wPos;

    float coef = 0.01f;

    vec3 normal = -GetNormal(A, B, C);

    A = (A + normal * (MAGNITUDE + coef * vIn[0].dist));
    B = (B + normal * (MAGNITUDE + coef * vIn[1].dist));
    C = (C + normal * (MAGNITUDE + coef * vIn[2].dist));

    vec3 newNormal = -GetNormal(A, B, C);
       
    
    vOut.wPos = A;
    gl_Position = params.mProjView * vec4(vOut.wPos, 1.f);
    vOut.wNorm = newNormal;
    vOut.wTangent = vIn[0].wTangent;
    vOut.texCoord = vIn[0].texCoord;
    EmitVertex();

    vOut.wPos = B;
    gl_Position = params.mProjView * vec4(vOut.wPos, 1.f);
    vOut.wNorm = newNormal;
    vOut.wTangent = vIn[1].wTangent;
    vOut.texCoord = vIn[1].texCoord;
    EmitVertex();

    vOut.wPos = C;
    gl_Position = params.mProjView * vec4(vOut.wPos, 1.f);
    vOut.wNorm = newNormal;
    vOut.wTangent = vIn[2].wTangent;
    vOut.texCoord = vIn[2].texCoord;
    EmitVertex();

    EndPrimitive();
}  