#version 450
#extension GL_ARB_separate_shader_objects : enable
#extension GL_GOOGLE_include_directive : require

#include "unpack_attributes.h"
#include "common.h"
#include "noise.glsl"


layout(location = 0) in vec4 vPosNorm;
layout(location = 1) in vec4 vTexCoordAndTang;

layout(push_constant) uniform params_t
{
    mat4 mProjView;
    mat4 mModel;
    uint bVetexShadows;
    uint bFragmentShadows;
    uint bUseHeightMap;
    uint bUseNormalMap;
} params;

layout(binding = 0, set = 0) uniform AppData
{
    UniformParams Params;
};

layout (binding = 1) uniform sampler2D heightTex;
layout (binding = 2) uniform sampler2D normalTex;

layout (location = 0 ) out VS_OUT
{
    vec3 wPos;
    vec3 wNorm;
    vec3 wTangent;
    vec2 texCoord;

} vOut;


float PI = 3.14;

out gl_PerVertex { vec4 gl_Position; };
void main(void)
{
    const vec4 wNorm = vec4(DecodeNormal(floatBitsToInt(vPosNorm.w)),         0.0f);
    const vec4 wTang = vec4(DecodeNormal(floatBitsToInt(vTexCoordAndTang.z)), 0.0f);

    vOut.wPos     = (params.mModel * vec4(vPosNorm.xyz, 1.0f)).xyz;
    float divider = 3 * 50;
    float multiplier;
    if (params.bUseHeightMap == 1)
        multiplier = 5.0 * 50;
    else
        multiplier = 2.0 * 50;

    vOut.texCoord = vTexCoordAndTang.xy;
    float height = 0;

    if (params.bUseHeightMap == 1) {
        height = textureLod(heightTex, vOut.texCoord, 0).x * multiplier;
        vOut.wPos.y = height;
    } 
    else {
        height = noise(vOut.wPos.xz / divider) * multiplier;
        vOut.wPos.y = height;
    }

    if (params.bUseNormalMap == 1 && params.bUseHeightMap == 1) {
        vOut.wNorm = -textureLod(normalTex, vOut.texCoord, 0).xzy;
    }
    else {
        if (params.bUseHeightMap == 1) {
            float width = 512;
            float R, L, B, T;
            float delta = 1 / width;
            vec2 deltaX = vec2(delta, 0.0);
            vec2 deltaY = vec2(0.0, delta);
            R = textureLod(heightTex, vOut.texCoord + deltaX, 0).x;
            L = textureLod(heightTex, vOut.texCoord - deltaX, 0).x;
            T = textureLod(heightTex, vOut.texCoord + deltaY, 0).x;
            B = textureLod(heightTex, vOut.texCoord - deltaY, 0).x;
            vec3 norm = normalize(vec3((R - L) / (2 * delta), -1, (B - T) / (2 * delta)));
            vOut.wNorm = norm;
        } 
        else {
            float R, L, B, T;
            float delta = 0.0001;
            vec2 deltaX = vec2(delta, 0.0);
            vec2 deltaY = vec2(0.0, delta);
            R = noise(vOut.wPos.xz / divider + deltaX);
            L = noise(vOut.wPos.xz / divider - deltaX);
            T = noise(vOut.wPos.xz / divider + deltaY);
            B = noise(vOut.wPos.xz / divider - deltaY);
            vec3 norm = normalize(vec3((R - L) / (2 * delta), -1, (B - T) / (2 * delta)));
            vOut.wNorm = norm;
        }

    }

    vec3 lightDir1 = normalize(Params.lightPos.xyz);
    float shadow = 1.0;
    float scale = 10 * 50;
    float width = 512;
    float stepXZ = 1 / width;
    float step = 0.1 * 50;
   
    if (params.bVetexShadows == 1) {
        if (params.bUseHeightMap != 1) {
            vec3 ray_pos = vOut.wPos;
            vec3 dir = lightDir1;
            while (length(dir.xz) > 0.1 && all(lessThan(ray_pos.xz, vec2(scale))) && all(greaterThan(ray_pos.xz, vec2(-scale)))) {
                ray_pos -= step * dir;
                float height = noise(ray_pos.xz / divider) * multiplier;
                if (height - ray_pos.y > 0.0) {
                    shadow = 0.0;
                    break;
                }
            }
        }
        else {
            vec2 ray_pos = vOut.texCoord;
            vec3 dir = lightDir1;
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
        }
    }

    vOut.wTangent.x = shadow;

    gl_Position   = params.mProjView * vec4(vOut.wPos, 1.0);
}
