#version 450
#extension GL_GOOGLE_include_directive : require

#include "common.h"


layout (binding = 0) uniform sampler2D samplerPosition;
layout (binding = 1) uniform sampler2D samplerNormal;
layout (binding = 2) uniform sampler2D samplerAlbedo;
layout (binding = 3) uniform sampler2D samplerDepth;


layout(binding = 4) uniform Samples
{
    vec4 ssao[SSAO_KERNEL_SIZE];
};

layout(binding = 5, set = 0) uniform AppData
{
    UniformParams Params;
};

float rand(float n){return fract(sin(n) * 43758.5453123);}

float noise(float p){
	float fl = floor(p);
  float fc = fract(p);
	return mix(rand(fl), rand(fl + 1.0), fc);
}

float NOISE_SCALE = 10.f;

vec3 sampleRotation(vec2 uv) {
    return vec3(
        noise(uv.x) * 2 - 1,
        noise(uv.y) * 2 - 1,
        0.0f
    ) / NOISE_SCALE;
}



layout(push_constant) uniform params_t
{
    mat4 mProj;
    mat4 mView;
    mat4 lightModel;
    vec4 color;
    vec4 lightPos;
    vec2 screenSize; 
    uint isOutsideLight;
} params;

layout (location = 0) in vec2 inUV;

layout (location = 0) out vec4 outFragcolor;

void main() 
{
    vec2 uv = gl_FragCoord.xy / params.screenSize;
    vec3 fragPos = texture(samplerPosition, uv).rgb;
	vec3 normal = texture(samplerNormal, uv).rgb * 0.5 + 0.5;
	vec4 albedo = texture(samplerAlbedo, uv);
    float depth = texture(samplerDepth, uv).r;

    vec3 lightDir1 = normalize(params.lightPos.xyz -fragPos);
    float lightDist = distance(params.lightPos.xyz, fragPos);
    float lightRadius = params.lightModel[0][0];

    if (lightDist > lightRadius) {
        outFragcolor = vec4(0.0f);
        return;
    }

    const vec4 dark_violet = vec4(0.59f, 0.0f, 0.82f, 1.0f);
    const vec4 chartreuse  = vec4(0.5f, 1.0f, 0.0f, 1.0f);

    vec4 lightColor1 = mix(dark_violet, chartreuse, 0.5f);

    vec3 N = normal; 

    vec4 color1 = max(dot(N, lightDir1), 0.0f) * lightColor1;
    float intensity = 1.f;
    float attn = clamp(1.0 - lightDist*lightDist/(lightRadius*lightRadius), 0.0, 1.0); 
    attn *= attn;

    vec3 randomVec = sampleRotation(uv);  

    vec3 tangent   = normalize(randomVec - normal * dot(randomVec, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN       = mat3(tangent, bitangent, normal);  

    float occlusion = 1.0;
    uint kernelSize = SSAO_KERNEL_SIZE;
    float radius = Params.radiusSSAO;
    float bias = 0.025;
    vec4 fragViewPos = vec4(fragPos, 1.0);

    if (Params.enableSSAO) {
        for(int i = 0; i < kernelSize; ++i)
        {
            vec4 samplePos = fragViewPos + vec4( TBN * ssao[i].xyz, 0.0) * radius;
            vec4 offset = params.mProj * samplePos;
            offset.xyz /= offset.w;
            offset.xyz  = (offset.xyz * 0.5 + 0.5);

            float sampleDepth = texture(samplerPosition, offset.xy).z; 
            float rangeCheck = smoothstep(0.0, 1.0, radius / abs(fragViewPos.z - sampleDepth));
            occlusion       += (sampleDepth >= samplePos.z + bias ? 1.0 : 0.0) * rangeCheck;   
        }  
        occlusion = 1 - occlusion / kernelSize;
    }

    outFragcolor = color1 * albedo * attn * occlusion;
}