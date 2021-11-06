#version 450 core

layout(triangles, equal_spacing, ccw) in;

layout (location = 0 ) in VS_OUT
{
    vec3 wPos;
    vec3 wTangent;
    vec2 texCoord;

} vIn[];


layout (location = 0 ) out VS_OUT
{
    vec3 wPos;
    vec3 wTangent;
    vec2 texCoord;
    float dist;

} vOut;

vec2 interpolate2D(vec2 v0, vec2 v1, vec2 v2)
{
    return vec2(gl_TessCoord.x) * v0 + vec2(gl_TessCoord.y) * v1 + vec2(gl_TessCoord.z) * v2;
}

vec3 interpolate3D(vec3 v0, vec3 v1, vec3 v2)
{
    return vec3(gl_TessCoord.x) * v0 + vec3(gl_TessCoord.y) * v1 + vec3(gl_TessCoord.z) * v2;
}

vec4 interpolate4D(vec4 v0, vec4 v1, vec4 v2)
{
    return vec4(gl_TessCoord.x) * v0 + vec4(gl_TessCoord.y) * v1 + vec4(gl_TessCoord.z) * v2;
}

void main() {
    vOut.wPos = interpolate3D(vIn[0].wPos, vIn[1].wPos, vIn[2].wPos);
    vOut.wTangent = interpolate3D(vIn[0].wTangent, vIn[1].wTangent, vIn[2].wTangent);
    vOut.texCoord = interpolate2D(vIn[0].texCoord, vIn[1].texCoord, vIn[2].texCoord);
    vOut.dist = distance(gl_TessCoord, vec3(1) / 3);
    gl_Position = interpolate4D(gl_in[0].gl_Position, gl_in[1].gl_Position, gl_in[2].gl_Position);
}