from typing import (
    Callable,
    Generic,
    NoReturn,
    TypeVar,
)

T = TypeVar("T")   # 成功時の値
E = TypeVar("E")   # 失敗時の値
U = TypeVar("U")   # map 後の成功値
F = TypeVar("F")   # map_err 後の失敗値


class Result(Generic[T, E]):

    # ファクトリーメソッド
    @staticmethod
    def ok(value: T) -> "Result[T, E]":
        return Ok(value)

    @staticmethod
    def err(error: E) -> "Result[T, E]":
        return Err(error)

    # 判定
    def is_ok(self) -> bool: ...
    def is_err(self) -> bool: ...

    # 値を取り出す
    def unwrap(self) -> T: ...
    def unwrap_err(self) -> E: ...
    def unwrap_or(self, default: T) -> T: ...
    def unwrap_or_else(self, fn: Callable[[E], T]) -> T: ...

    # 変換
    def map(self, fn: Callable[[T], U]) -> "Result[U, E]": ...
    def map_err(self, fn: Callable[[E], F]) -> "Result[T, F]": ...
    def and_then(self, fn: Callable[[T], "Result[U, E]"]) -> "Result[U, E]": ...
    def or_else(self, fn: Callable[[E], "Result[T, F]"]) -> "Result[T, F]": ...


class Ok(Result[T, E]):
    __slots__ = ("_value",)
    __match_args__ = ("_value",)

    def __init__(self, value: T) -> None:
        self._value = value

    # 判定
    def is_ok(self) -> bool:  # noqa: D401
        return True

    def is_err(self) -> bool:  # noqa: D401
        return False

    # 値を取り出す
    def unwrap(self) -> T:
        return self._value

    def unwrap_err(self) -> NoReturn:  # type: ignore[override]
        raise RuntimeError("Called unwrap_err() on Ok")

    def unwrap_or(self, default: T) -> T:  # noqa: ARG002
        return self._value

    def unwrap_or_else(self, fn: Callable[[E], T]) -> T:  # noqa: ARG002
        return self._value

    # 変換
    def map(self, fn: Callable[[T], U]) -> "Result[U, E]":
        return Ok(fn(self._value))

    def map_err(self, fn: Callable[[E], F]) -> "Result[T, F]":
        return Ok(self._value)  # 型だけ変わる

    def and_then(self, fn: Callable[[T], "Result[U, E]"]) -> "Result[U, E]":
        return fn(self._value)

    def or_else(self, fn: Callable[[E], "Result[T, F]"]) -> "Result[T, F]":
        return Ok(self._value)


class Err(Result[T, E]):
    __slots__ = ("_error",)
    __match_args__ = ("_error",)

    def __init__(self, error: E) -> None:
        self._error = error

    def is_ok(self) -> bool:  # noqa: D401
        return False

    def is_err(self) -> bool:  # noqa: D401
        return True

    def unwrap(self) -> NoReturn:  # type: ignore[override]
        raise RuntimeError(f"Called unwrap() on Err: {self._error!r}")

    def unwrap_err(self) -> E:
        return self._error

    def unwrap_or(self, default: T) -> T:
        return default

    def unwrap_or_else(self, fn: Callable[[E], T]) -> T:
        return fn(self._error)

    # 変換
    def map(self, fn: Callable[[T], U]) -> "Result[U, E]":  # noqa: ARG002
        return Err(self._error)

    def map_err(self, fn: Callable[[E], F]) -> "Result[T, F]":
        return Err(fn(self._error))

    def and_then(self, fn: Callable[[T], "Result[U, E]"]) -> "Result[U, E]":  # noqa: ARG002
        return Err(self._error)

    def or_else(self, fn: Callable[[E], "Result[T, F]"]) -> "Result[T, F]":
        return fn(self._error)
