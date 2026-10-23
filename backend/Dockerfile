# ---------- build ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

# ---------- run ----------
FROM eclipse-temurin:21-jre
ENV TZ=Asia/Ho_Chi_Minh \
    JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError"
RUN groupadd --system app && useradd --system --gid app app \
    && mkdir -p /app/uploads && chown -R app:app /app
WORKDIR /app
COPY --from=build /src/target/flower-shop-*.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
