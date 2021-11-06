#version 450

layout (location = 0 ) in VS_OUT
{
    vec3 wPos;
    vec3 wTangent;
    vec2 texCoord;

} vIn[];

layout ( vertices = 3 ) out;   

layout (location = 0 ) out VS_OUT
{
    vec3 wPos;
    vec3 wTangent;
    vec2 texCoord;

} vOut[];

void main ()
{                                       // copy current vertex to output
    gl_out [gl_InvocationID].gl_Position = gl_in [gl_InvocationID].gl_Position;

    vOut[gl_InvocationID].wPos = vIn[gl_InvocationID].wPos;
    vOut[gl_InvocationID].wTangent = vIn[gl_InvocationID].wTangent;
    vOut[gl_InvocationID].texCoord = vIn[gl_InvocationID].texCoord;
    int inner = 3;
    int outer = 1;
    if ( gl_InvocationID == 0 )         // set tessellation level, can do only for one vertex
    {
        
        gl_TessLevelInner [0] = inner;
        gl_TessLevelOuter [0] = outer;
        gl_TessLevelOuter [1] = outer;
        gl_TessLevelOuter [2] = outer;
    }
}