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
    float step = 0.1 * 50;
    vec3 dir = lightDir1;
    

    if (params.bFragmentShadows == 1) {
        if (params.bUseHeightMap == 1) {
            vec2 ray_pos = surf.texCoord;
            float height = textureLod(heightTex, surf.texCoord, 0).x * multiplier;
            float ray_height = height;
            while (length(dir.xz) > 0.1 && all(lessThan(ray_pos, vec2(1))) && all(greaterThan(ray_pos, vec2(0)))) {
                ray_pos -= stepXZ * dir.xz;
                ray_height -= dir.y;
                float height2 = textureLod(heightTex, ray_pos, 0).x * multiplier;
                if (height2 - ray_height > 0.0) {
                    shadow = 0.0;
                    break;
                }
            }
        } else {
            vec3 ray_pos = surf.wPos;    
            while (length(dir.xz) > 0.1 && all(lessThan(ray_pos.xz, vec2(scale))) && all(greaterThan(ray_pos.xz, vec2(-scale)))) {
                ray_pos -= step * dir;
                float height2 = noise(ray_pos.xz / divider) * multiplier;
                if (height2 - ray_pos.y > 0.0) {
                    shadow = 0.0;
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
    // color1 = lightColor1;
    // vec4 color2 = max(dot(N, lightDir2), 0.0f) * lightColor2;
    // vec4 color_lights = mix(color1, color2, 0.2f);

    out_fragColor = color1 * vec4(Params.baseColor.xyz, 1.0f) * shadow;
    // out_fragColor = vec4(N, 1.0);
    // out_fragColor = vec4(fract(surf.wPos / 100), 1.0);
}