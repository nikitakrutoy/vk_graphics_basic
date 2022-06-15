#version 450
#extension GL_ARB_separate_shader_objects : enable
#extension GL_GOOGLE_include_directive : require

#include "common.h"

layout(location = 0) out vec4 out_fragColor;

layout (location = 0 ) in VS_OUT
{
  vec3 wPos;
  vec3 wNorm;
  vec3 wTangent;
  vec2 texCoord;
} surf;

layout(binding = 0, set = 0) uniform AppData
{
  UniformParams Params;
};

layout (binding = 1) uniform sampler2D shadowMap;

vec3 T(float s) {
    return vec3(0.233, 0.455, 0.649) * exp(-s*s/0.0064) + \
           vec3(0.1, 0.336, 0.344) * exp(-s*s/0.0484) + \
           vec3(0.118, 0.198, 0.0) * exp(-s*s/0.187) + \
           vec3(0.113, 0.007, 0.007) * exp(-s*s/0.567) + \
           vec3(0.358, 0.004, 0.0) * exp(-s*s/1.99) + \
           vec3(0.078, 0.0, 0.0) * exp(-s*s/7.41);
}

float transCoef = 0.5;

void main()
{
  const vec4 posLightClipSpace = Params.lightMatrix*vec4(surf.wPos, 1.0f); // 
  const vec3 posLightSpaceNDC  = posLightClipSpace.xyz/posLightClipSpace.w;    // for orto matrix, we don't need perspective division, you can remove it if you want; this is general case;
  const vec2 shadowTexCoord    = posLightSpaceNDC.xy*0.5f + vec2(0.5f, 0.5f);  // just shift coords from [-1,1] to [0,1] 
  const float sampledDepth = textureLod(shadowMap, shadowTexCoord, 0).x;              
    
  const bool  outOfView = (shadowTexCoord.x < 0.0001f || shadowTexCoord.x > 0.9999f || shadowTexCoord.y < 0.0091f || shadowTexCoord.y > 0.9999f);
  const float shadow    = ((posLightSpaceNDC.z < sampledDepth + 0.001f) || outOfView) ? 1.0f : 0.0f;

  const vec4 dark_violet = vec4(0.5f, 0.0f, 0.82f, 1.0f);
  const vec4 blue  = vec4(0.5f, 0.5f, 1.0f, 1.0f);

  // vec4 lightColor1 = mix(dark_violet, chartreuse, abs(sin(Params.time)));
  vec4 lightColor2 = vec4(1.0f, 1.0f, 1.0f, 1.0f);
   
  vec3 lightDir   = normalize(Params.lightPos - surf.wPos);
  vec4 lightColor =max(dot(surf.wNorm, lightDir), 0.0f) * lightColor2;
  vec3 albedo = blue.xyz;
  float s = abs(sampledDepth - posLightSpaceNDC.z);
  float E = max(0.3 + dot(-surf.wNorm, lightDir), 0.0);
  vec3 transmittance = T(s) * dark_violet.xyz * E * transCoef;
  out_fragColor   = (lightColor*shadow + vec4(0.1f)) * vec4(albedo, 1.0f);
  out_fragColor += vec4(transmittance, 1.0f); 
}
