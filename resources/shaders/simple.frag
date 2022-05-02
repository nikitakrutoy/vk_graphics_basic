#version 450
#extension GL_ARB_separate_shader_objects : enable
#extension GL_GOOGLE_include_directive : require

#include "common.h"
#include "noise.glsl"

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

layout (binding = 1) uniform sampler2D heightTex;
// layout (binding = 2) uniform sampler2D normalTex;

layout(push_constant) uniform params_t
{
    mat4 mProjView;
    mat4 mModel;
    uint bVetexShadows;
    uint bFragmentShadows;
    uint bUseHeightMap;
    uint bUseNormalMap;
} params;

mat4 invViewProj = inverse(params.mProjView);

vec4 screenToWorld(vec2 pos, float depth)
{
    const vec4 sPos = vec4(2.0 * pos - 1.0, depth, 1.0);
    const vec4 wPos = invViewProj * sPos;
    return wPos / wPos.w;
}

float fogDensity(vec3 pos)
{
    float max_height = Params.fogHeight;
    float height_mult = clamp(exp(-pos.y / max_height) , 0, 1);
    return clamp(((cnoise(pos /  Params.fogDensity  + vec3(Params.time, 0, Params.time) / 1) + 1) /2) * 0.03f, 0, 1) * height_mult;
}

void main()
{
    vec3 lightDir1 = normalize(Params.lightPos.xyz);
    vec3 lightDir2 = vec3(0.0f, 0.0f, 1.0f);
    float shadow = surf.wTangent.x;

    float scale = 10 * 50;
    float divider = 3 * 50;
    float multiplier;
    if (params.bUseHeightMap == 1)
        multiplier = 5.0 * 50;
    else
        multiplier = 2.0 * 50;

    float width = 512;
    float stepXZ = 1 / width;
    float stepShadow = 0.1 * 50;
    vec3 dirLight = lightDir1;
    

    if (params.bFragmentShadows == 1) {
        if (params.bUseHeightMap == 1) {
            vec2 rayPos = surf.texCoord;
            float height = textureLod(heightTex, surf.texCoord, 0).x * multiplier;
            float ray_height = height;
            while (length(dirLight.xz) > 0.1 && all(lessThan(rayPos, vec2(1))) && all(greaterThan(rayPos, vec2(0)))) {
                rayPos -= stepXZ * dirLight.xz;
                ray_height -= dirLight.y;
                float height2 = textureLod(heightTex, rayPos, 0).x * multiplier;
                if (height2 - ray_height > 0.0) {
                    shadow = 0.0;
                    break;
                }
            }
        } else {
            vec3 rayPos = surf.wPos;  
            shadow = 1;  
            dirLight.z = -dirLight.z;
            while (length(dirLight.xz) > 0.1 && all(lessThan(rayPos.xz, vec2(scale))) && all(greaterThan(rayPos.xz, vec2(-scale)))) {
                rayPos -= stepShadow * dirLight;
                float height2 = noise(rayPos.xz / divider) * multiplier;
                if (height2 - rayPos.y > 0.0) {
                    shadow = 0.1;
                    break;
                }
                if (Params.enableFog)
                    shadow *= exp(-fogDensity(rayPos) * stepShadow);
                if (shadow < 0.0001f)
                {
                    break;
                }
            }
        }
    }

    const vec4 dark_violet = vec4(0.59f, 0.0f, 0.82f, 1.0f);
    const vec4 chartreuse  = vec4(0.5f, 1.0f, 0.0f, 1.0f);

    vec4 lightColor1 = mix(dark_violet, chartreuse, 0.5f);
    vec4 lightColor2 = vec4(1.0f, 1.0f, 1.0f, 1.0f);

    vec3 N = surf.wNorm; 

    vec4 color1 = max(dot(N, lightDir1), 0.0f) * lightColor1;

    out_fragColor = color1 * vec4(Params.baseColor.xyz, 1.0f) * shadow;

    if (!Params.enableFog) return;

    // Fog

    const vec2 fragPos = gl_FragCoord.xy / vec2(Params.screenWidth, Params.screenHeight);

    const vec4 wCamPos = screenToWorld(vec2(0.5), 0);
    vec3 surfPos = surf.wPos;
    vec3 dirFog = normalize(surfPos - wCamPos.xyz);

    vec3 pos = screenToWorld(fragPos.xy, 0).xyz;

    float stepFog = Params.fogStep;
    float translucency = 1;
    vec3 fogColor = vec3(0);

    const vec4 baseFogColor = vec4(Params.fogColor, 0.);

    stepShadow = 40;

    for (uint i = 0; i < Params.fogStepNum; ++i)
    {
        vec3 rayPos = pos;  
        shadow = 1;  
        // while (length(dirLight.xz) > 0.1 && all(lessThan(rayPos.xz, vec2(scale + 50))) && all(greaterThan(rayPos.xz, vec2(-scale)))) {
        for (uint i = 0; i < Params.fogShadowStepNum; ++i) {
            rayPos -= stepShadow * dirLight;
            float height2 = noise(rayPos.xz / divider) * multiplier;
            if (height2 - rayPos.y > 0.0) {
                shadow = 0.1;
                break;
            }
            shadow *= exp(-fogDensity(rayPos) * stepShadow);
            if (shadow < 0.0001f)
            {
                break;
            }
        }

        float beersTerm = exp(-fogDensity(pos) * stepFog);
        fogColor += translucency * baseFogColor.xyz * shadow * (1 - beersTerm) * 0.5f;

        translucency *=  beersTerm;
        // translucency *= exp(-(fogDensity(pos)*stepFog));
        if (dot(pos, dirFog) > dot(surfPos, dirFog) || translucency < 0.0001f)
        {
            break;
        }
        pos += dirFog * stepFog;
    }

    out_fragColor = vec4((translucency * out_fragColor.xyz + fogColor), 1);
}