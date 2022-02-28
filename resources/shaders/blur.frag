#version 450
#extension GL_ARB_separate_shader_objects : enable
#extension GL_GOOGLE_include_directive : require

#include "common.h"

layout(location = 0) out vec2 out_fragColor;
layout (binding = 0) uniform sampler2D shadowMap;

layout(push_constant) uniform params_t
{
    uint width;
    uint height;
    bool enableBlur;
} params;

void main()
{
    vec2 resolution = vec2(params.width, params.height);
    vec2 uv = gl_FragCoord.xy / resolution;

    if (!params.enableBlur) {
        float d = textureLod(shadowMap, uv, 0).x;
        out_fragColor = vec2(d, d * d);
        return;
    }

    float res1 = 0;
    float res2 = 0;
    float t;
    float k;
    for (float i = -3; i <= 3; i = i + 1) {
        for (float j = -3; j <= 3; j = j + 1) {
            t = textureLod(shadowMap, uv + vec2(i, j) / resolution, 0).x;
            res1 += t;
            res2 += t*t;
        }
    }
    out_fragColor = vec2(res1 / 49, res2 / 49);
}