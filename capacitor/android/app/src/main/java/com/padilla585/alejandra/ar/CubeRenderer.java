package com.padilla585.alejandra.ar;

import android.opengl.GLES20;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.ShortBuffer;

/**
 * REPL-AR-NATIVO-COMP-01 (17/09/2026): renderer mínimo de un cubo sólido con sombreado plano
 * (Lambertiano simple, sin texturas), para dibujar los complementos del replanteo (cajas,
 * mecanismos...) anclados en el AR nativo -- hasta ahora ReplanteoARActivity solo pintaba el
 * feed de cámara + un overlay 2D de puntos (ver el comentario en la clase), sin ningún objeto
 * 3D real. Cada complemento se representa como UNA caja con el tamaño/color aproximado de su
 * geometría en repl3d.js (Three.js, usado por la PWA) -- ver REPL_COMPLEMENTOS_NATIVO más abajo.
 * No es fiel al detalle de repl3d.js (ahí un enchufe son 3 piezas con cilindros), es la versión
 * "de bulto" para que se pueda marcar y ver dónde va cada accesorio durante la sesión AR nativa;
 * la vista 3D/informe de la PWA ya dibuja el detalle real a partir de la misma key guardada.
 */
class CubeRenderer {
    private static final int FLOAT_SIZE = 4;
    private static final int SHORT_SIZE = 2;

    // 6 caras x 4 vértices, cubo unidad centrado en el origen (-0.5..0.5), con normal por cara.
    private static final float[] POSITIONS = {
        // +X
        0.5f, -0.5f, -0.5f,  0.5f,  0.5f, -0.5f,  0.5f,  0.5f,  0.5f,  0.5f, -0.5f,  0.5f,
        // -X
        -0.5f, -0.5f,  0.5f, -0.5f,  0.5f,  0.5f, -0.5f,  0.5f, -0.5f, -0.5f, -0.5f, -0.5f,
        // +Y
        -0.5f,  0.5f, -0.5f, -0.5f,  0.5f,  0.5f,  0.5f,  0.5f,  0.5f,  0.5f,  0.5f, -0.5f,
        // -Y
        -0.5f, -0.5f,  0.5f, -0.5f, -0.5f, -0.5f,  0.5f, -0.5f, -0.5f,  0.5f, -0.5f,  0.5f,
        // +Z
        -0.5f, -0.5f,  0.5f,  0.5f, -0.5f,  0.5f,  0.5f,  0.5f,  0.5f, -0.5f,  0.5f,  0.5f,
        // -Z
        0.5f, -0.5f, -0.5f, -0.5f, -0.5f, -0.5f, -0.5f,  0.5f, -0.5f,  0.5f,  0.5f, -0.5f,
    };
    private static final float[] NORMALS = {
        1,0,0, 1,0,0, 1,0,0, 1,0,0,
        -1,0,0, -1,0,0, -1,0,0, -1,0,0,
        0,1,0, 0,1,0, 0,1,0, 0,1,0,
        0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
        0,0,1, 0,0,1, 0,0,1, 0,0,1,
        0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    };
    private static final short[] INDICES = new short[36];
    static {
        for (int face = 0; face < 6; face++) {
            short base = (short) (face * 4);
            int o = face * 6;
            INDICES[o] = base; INDICES[o + 1] = (short) (base + 1); INDICES[o + 2] = (short) (base + 2);
            INDICES[o + 3] = base; INDICES[o + 4] = (short) (base + 2); INDICES[o + 5] = (short) (base + 3);
        }
    }

    private static final String VERTEX =
        "uniform mat4 u_MVPMatrix;\n" +
        "uniform mat4 u_ModelMatrix;\n" +
        "attribute vec4 a_Position;\n" +
        "attribute vec3 a_Normal;\n" +
        "varying vec3 v_WorldNormal;\n" +
        "void main() {\n" +
        "  gl_Position = u_MVPMatrix * a_Position;\n" +
        "  v_WorldNormal = normalize((u_ModelMatrix * vec4(a_Normal, 0.0)).xyz);\n" +
        "}";

    private static final String FRAGMENT =
        "precision mediump float;\n" +
        "uniform vec4 u_Color;\n" +
        "varying vec3 v_WorldNormal;\n" +
        "void main() {\n" +
        "  vec3 lightDir = normalize(vec3(0.4, 0.85, 0.35));\n" +
        "  float diff = max(dot(v_WorldNormal, lightDir), 0.0);\n" +
        "  float shade = 0.55 + 0.45 * diff;\n" +
        "  gl_FragColor = vec4(u_Color.rgb * shade, u_Color.a);\n" +
        "}";

    private int program;
    private int positionAttrib, normalAttrib, mvpUniform, modelUniform, colorUniform;
    private FloatBuffer positionBuffer, normalBuffer;
    private ShortBuffer indexBuffer;

    void createOnGlThread() {
        ByteBuffer pb = ByteBuffer.allocateDirect(POSITIONS.length * FLOAT_SIZE).order(ByteOrder.nativeOrder());
        positionBuffer = pb.asFloatBuffer(); positionBuffer.put(POSITIONS); positionBuffer.position(0);
        ByteBuffer nb = ByteBuffer.allocateDirect(NORMALS.length * FLOAT_SIZE).order(ByteOrder.nativeOrder());
        normalBuffer = nb.asFloatBuffer(); normalBuffer.put(NORMALS); normalBuffer.position(0);
        ByteBuffer ib = ByteBuffer.allocateDirect(INDICES.length * SHORT_SIZE).order(ByteOrder.nativeOrder());
        indexBuffer = ib.asShortBuffer(); indexBuffer.put(INDICES); indexBuffer.position(0);

        int vertexShader = loadShader(GLES20.GL_VERTEX_SHADER, VERTEX);
        int fragmentShader = loadShader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT);
        program = GLES20.glCreateProgram();
        GLES20.glAttachShader(program, vertexShader);
        GLES20.glAttachShader(program, fragmentShader);
        GLES20.glLinkProgram(program);
        positionAttrib = GLES20.glGetAttribLocation(program, "a_Position");
        normalAttrib = GLES20.glGetAttribLocation(program, "a_Normal");
        mvpUniform = GLES20.glGetUniformLocation(program, "u_MVPMatrix");
        modelUniform = GLES20.glGetUniformLocation(program, "u_ModelMatrix");
        colorUniform = GLES20.glGetUniformLocation(program, "u_Color");
    }

    /**
     * Dibuja una caja de mvpMatrix/modelMatrix ya construidas por el llamador (traslación +
     * rotación del anchor + escala = tamaño real en metros del complemento).
     */
    void draw(float[] mvpMatrix, float[] modelMatrix, float r, float g, float b, float a) {
        GLES20.glUseProgram(program);
        GLES20.glUniformMatrix4fv(mvpUniform, 1, false, mvpMatrix, 0);
        GLES20.glUniformMatrix4fv(modelUniform, 1, false, modelMatrix, 0);
        GLES20.glUniform4f(colorUniform, r, g, b, a);
        positionBuffer.position(0);
        GLES20.glVertexAttribPointer(positionAttrib, 3, GLES20.GL_FLOAT, false, 0, positionBuffer);
        GLES20.glEnableVertexAttribArray(positionAttrib);
        normalBuffer.position(0);
        GLES20.glVertexAttribPointer(normalAttrib, 3, GLES20.GL_FLOAT, false, 0, normalBuffer);
        GLES20.glEnableVertexAttribArray(normalAttrib);
        indexBuffer.position(0);
        GLES20.glDrawElements(GLES20.GL_TRIANGLES, INDICES.length, GLES20.GL_UNSIGNED_SHORT, indexBuffer);
        GLES20.glDisableVertexAttribArray(positionAttrib);
        GLES20.glDisableVertexAttribArray(normalAttrib);
    }

    private static int loadShader(int type, String code) {
        int shader = GLES20.glCreateShader(type);
        GLES20.glShaderSource(shader, code);
        GLES20.glCompileShader(shader);
        return shader;
    }
}
