from kit_scraper.fetch import retry_delay


def test_retry_delay_backs_off_exponentially():
    assert [retry_delay(1.0, a) for a in range(3)] == [1.0, 3.0, 9.0]
